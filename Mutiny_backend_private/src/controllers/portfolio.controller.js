const mongoose = require('mongoose');
const { Portfolio } = require('../models/portfolio.model.js');
const { Investor }  = require('../models/user.model.js');
const { Idea }      = require('../models/ideas.model.js');
const { pushNotification, ideaLink } = require('../services/notifications.service.js');
const { isPublicIdea } = require('../community/targets.js');
const { incrementTrust }   = require('../utils/trust.util.js');
const {
    publishInvestmentCommitted,
    publishInvestmentReleased,
} = require('../utils/kafkaProducer.js');


const assertInvestor = (req, res) => {
	if (req.user.role !== 'Investor') {
		res.status(403).json({ success: false, message: 'Investor account required' });
		return false;
	}
	return true;
};




// Finite and bounded: "Infinity" passes an isNaN check and would be stored (and served as null).
const MAX_AMOUNT = 1e9;
// At least $1, as the message says: fractions of a cent made trust farmable (X-10).
const validAmount = (amount) => {
	const n = Number(amount);
	return Number.isFinite(n) && n >= 1 && n <= MAX_AMOUNT;
};
const toCents = (amount) => Math.round(Number(amount) * 100) / 100;

const commit = async (req, res) => {
	if (!assertInvestor(req, res)) return;

	const { ideaId, amount } = req.body || {};

	if (!ideaId || !mongoose.Types.ObjectId.isValid(ideaId)) {
		return res.status(400).json({ success: false, message: 'Valid ideaId is required' });
	}
	if (!validAmount(amount)) {
		return res.status(400).json({ success: false, message: 'Enter an amount between $1 and $1,000,000,000' });
	}

	try {
		
		const idea = await Idea.findById(ideaId).select('title founder_id isDraft moderation').lean();
		// Drafts and hidden ideas can't take commitments: to investors they don't exist.
		if (!isPublicIdea(idea)) {
			return res.status(404).json({ success: false, message: 'Idea not found' });
		}

		
		// One atomic write (X-45): the portfolio is created if needed, and the commitment is added
		// only when this idea isn't in it yet. The id is compared as an ObjectId, so the same id in
		// another letter case can't slip past (a string compare did).
		const ideaOid = new mongoose.Types.ObjectId(String(ideaId));
		let portfolio;
		try {
			portfolio = await Portfolio.findOneAndUpdate(
				{ investor_id: req.user._id, 'investments.idea_id': { $ne: ideaOid } },
				{ $push: { investments: { idea_id: ideaOid, amount_committed: toCents(amount), amount_released: 0, status: 'active' } } },
				{ new: true, upsert: true },
			);
		} catch (err) {
			// The portfolio exists and already has this idea: the upsert hit the unique investor_id.
			if (err.code === 11000) {
				return res.status(409).json({ success: false, message: 'You have already committed to this idea' });
			}
			throw err;
		}

		// The commitment is saved: what follows (the trust point, the founder's notification, the
		// chat reveal) must not turn it into an error, or a retry would hit "already committed".
		try {
			await Investor.findByIdAndUpdate(req.user._id, {
				portfolio_id: portfolio._id
			});

		
			await incrementTrust(req.user._id, { history: 1 });

		
			if (idea.founder_id) {
				const investor = await Investor
					.findById(req.user._id)
					.select('name firm verification.status')
					.lean();

				const investorName = investor?.name || 'An investor';
				const firmSuffix   = investor?.firm ? ` (${investor.firm})` : '';
				const verified     = investor?.verification?.status === 'verified' ? ', verified investor' : '';

				await pushNotification(
					idea.founder_id,
					`${investorName}${firmSuffix}${verified} committed $${toCents(amount).toLocaleString()} to your idea “${idea.title}”`,
					{ link: '/founder/funding' }
				);
				// Money needs a name (C5): any ghost chat with this founder shows it from now on.
				await require('../chat/chat.service.js').revealOnCommit({ investorId: req.user._id, founderId: idea.founder_id, ideaTitle: idea.title });
			}
		} catch (err) {
			console.error('commit side effects:', err);
		}

		publishInvestmentCommitted({
			investorId: req.user._id.toString(),
			ideaId:     String(ideaOid),
			amount:     toCents(amount),
		});

		return res.status(201).json({
			success: true,
			message: 'Commitment recorded',
			investment: portfolio.investments[portfolio.investments.length - 1]
		});

	} catch (err) {
		console.error('commit:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};



const get_portfolio = async (req, res) => {
	if (!assertInvestor(req, res)) return;

	try {
		const portfolio = await Portfolio
			.findOne({ investor_id: req.user._id })
			.populate({
				path:   'investments.idea_id',
				select: 'title stage tags founder_id author likes views milestones'
			})
			.lean();

		if (!portfolio) {
			return res.status(200).json({
				data:           [],
				totalCommitted: 0,
				totalReleased:  0
			});
		}

		// The founder behind each idea, as the same public card the idea page shows.
		const { Founder } = require('../models/user.model.js');
		const founderIds = portfolio.investments.map((inv) => inv.idea_id?.founder_id).filter(Boolean);
		const founders = new Map((await Founder.find({ _id: { $in: founderIds } })
			.select('name headline location avatar socials linkedin github').lean())
			.map((f) => [String(f._id), {
				id: f._id, name: f.name || '', headline: f.headline || '', location: f.location || '', avatarUrl: f.avatar || '',
				links: {
					linkedin: f.socials?.linkedin || f.linkedin || '',
					github:   f.socials?.github   || f.github   || '',
					website:  f.socials?.website  || '',
					twitter:  f.socials?.twitter  || '',
				},
			}]));

		const data = portfolio.investments.map((inv) => {
			const idea = inv.idea_id;   
			return {
				founder:          idea?.founder_id ? founders.get(String(idea.founder_id)) || null : null,
				id:               inv._id,
				ideaId:           idea?._id || inv.idea_id,
				name:             idea?.title      || 'Unknown',
				stage:            idea?.stage      || '',
				tags:             idea?.tags       || [],
				author:           idea?.author     || '',
				likes:            idea?.likes      || 0,
				committed:        inv.amount_committed,
				released:         inv.amount_released,
				status:           inv.status,
				committed_at:     inv.committed_at,
				releases:         (inv.releases || []).map((r) => ({ amount: r.amount, milestoneId: r.milestone_id, at: r.at })),
				milestones:       (idea?.milestones || []).map((m) => ({ id: m._id, title: m.title, status: m.status, doneAt: m.doneAt }))
			};
		});

		const totalCommitted = data.reduce((sum, r) => sum + r.committed, 0);
		const totalReleased  = data.reduce((sum, r) => sum + r.released,  0);

		return res.status(200).json({ data, totalCommitted, totalReleased });

	} catch (err) {
		console.error('get_portfolio:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};



// Withdrawing takes back a promise, so only before any money was released (X-95): released
// money stays on the founder's record. The history point it earned comes off the trust score,
// so commit → withdraw → commit can't farm trust (X-10), and the founder is told.
const withdraw = async (req, res) => {
	if (!assertInvestor(req, res)) return;

	const { investmentId } = req.params;
	if (!mongoose.isObjectIdOrHexString(investmentId)) {
		return res.status(400).json({ success: false, message: 'Invalid investment ID' });
	}

	try {
		const portfolio = await Portfolio.findOne({ investor_id: req.user._id }).select('investments').lean();
		const investment = portfolio?.investments.find((inv) => String(inv._id) === String(investmentId));
		if (!investment) {
			return res.status(404).json({ success: false, message: 'Investment not found' });
		}
		if ((investment.amount_released || 0) > 0) {
			return res.status(409).json({ success: false, message: "Money you've already released can't be withdrawn" });
		}

		const pulled = await Portfolio.updateOne(
			{ investor_id: req.user._id, investments: { $elemMatch: { _id: investment._id, amount_released: 0 } } },
			{ $pull: { investments: { _id: investment._id } } },
		);
		if (pulled.matchedCount !== 1) {
			return res.status(409).json({ success: false, message: 'This commitment just changed; refresh and try again' });
		}
		await incrementTrust(req.user._id, { history: -1 });

		const idea = await Idea.findById(investment.idea_id).select('title founder_id').lean();
		if (idea?.founder_id) {
			await pushNotification(idea.founder_id, `An investor withdrew their commitment to “${idea.title}”`, { link: '/founder/funding' });
		}
		return res.status(200).json({ success: true, message: 'Investment withdrawn' });

	} catch (err) {
		console.error('withdraw:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

module.exports = { commit, get_portfolio, withdraw };





async function release(req, res) {
	if (!assertInvestor(req, res)) return;

	const { investmentId } = req.params;
	const { amount, milestoneId } = req.body || {};

	if (!mongoose.Types.ObjectId.isValid(investmentId)) {
		return res.status(400).json({ success: false, message: 'Invalid investment ID' });
	}
	if (milestoneId !== undefined && milestoneId !== null && !mongoose.Types.ObjectId.isValid(milestoneId)) {
		return res.status(400).json({ success: false, message: 'Invalid milestone ID' });
	}
	if (!validAmount(amount)) {
		return res.status(400).json({ success: false, message: 'Enter an amount between $1 and $1,000,000,000' });
	}

	try {
		const portfolio = await Portfolio.findOne({ investor_id: req.user._id });
		if (!portfolio) {
			return res.status(404).json({ success: false, message: 'Portfolio not found' });
		}

		const investment = portfolio.investments.id(investmentId);
		if (!investment) {
			return res.status(404).json({ success: false, message: 'Investment not found' });
		}

		const releaseAmount = toCents(amount);
		const remaining = investment.amount_committed - investment.amount_released;

		if (releaseAmount > remaining) {
			return res.status(400).json({
				success: false,
				message: `Cannot release more than the remaining committed amount ($${remaining.toLocaleString()})`,
			});
		}

		// A release can be for a milestone the founder marked done on this idea.
		let milestone = null;
		if (milestoneId) {
			const ideaDoc = await Idea.findById(investment.idea_id).select('milestones').lean();
			milestone = (ideaDoc?.milestones || []).find((m) => String(m._id) === String(milestoneId)) || null;
			if (!milestone) return res.status(404).json({ success: false, message: 'Milestone not found on this idea' });
			if (milestone.status !== 'done') {
				return res.status(409).json({ success: false, message: 'The founder hasn\'t marked this milestone done yet' });
			}
		}

		investment.amount_released += releaseAmount;
		investment.releases.push({ amount: releaseAmount, milestone_id: milestone?._id ?? null, at: new Date() });

		
		if (investment.amount_released >= investment.amount_committed) {
			investment.status = 'released';
		}

		// Trust counts commitments that money actually reached, once each: many small releases on
		// one commitment earn the same as one (X-10).
		const firstRelease = investment.releases.length === 1;
		try {
			await portfolio.save();
		} catch (err) {
			// Two releases at once: Mongoose's version check stops the second (X-45).
			if (err.name === 'VersionError') {
				return res.status(409).json({ success: false, message: 'Another release just went through; refresh and try again' });
			}
			throw err;
		}

		if (firstRelease) await incrementTrust(req.user._id, { escrowReleases: 1 });

		publishInvestmentReleased({
			investorId:    req.user._id.toString(),
			ideaId:        investment.idea_id.toString(),
			investmentId:  investmentId,
			amount:        releaseAmount,
		});

		// Notify the founder
		const idea = await Idea.findById(investment.idea_id).select('title founder_id').lean();
		if (idea?.founder_id) {
			const investor = await Investor
				.findById(req.user._id)
				.select('name firm')
				.lean();

			const investorName = investor?.name || 'An investor';
			const firmSuffix   = investor?.firm ? ` (${investor.firm})` : '';

			await pushNotification(
				idea.founder_id,
				`${investorName}${firmSuffix} released $${releaseAmount.toLocaleString()} for “${idea.title}”${milestone ? ` (milestone “${milestone.title}”)` : ''}`,
				{ link: '/founder/funding' }
			);
		}

		return res.status(200).json({
			success: true,
			message: `$${releaseAmount.toLocaleString()} released`,
			investment: {
				id:               investment._id,
				amount_committed: investment.amount_committed,
				amount_released:  investment.amount_released,
				status:           investment.status,
			},
		});

	} catch (err) {
		console.error('release:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
}

module.exports = { commit, get_portfolio, withdraw, release };