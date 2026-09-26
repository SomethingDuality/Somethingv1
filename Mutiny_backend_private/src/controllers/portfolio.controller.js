const mongoose = require('mongoose');
const { Portfolio } = require('../models/portfolio.model.js');
const { Investor }  = require('../models/user.model.js');
const { Idea }      = require('../models/ideas.model.js');
const { pushNotification } = require('../services/notifications.service.js');
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
const validAmount = (amount) => {
	const n = Number(amount);
	return Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT;
};

const commit = async (req, res) => {
	if (!assertInvestor(req, res)) return;

	const { ideaId, amount } = req.body;

	if (!ideaId || !mongoose.Types.ObjectId.isValid(ideaId)) {
		return res.status(400).json({ success: false, message: 'Valid ideaId is required' });
	}
	if (!validAmount(amount)) {
		return res.status(400).json({ success: false, message: 'Enter an amount between $1 and $1,000,000,000' });
	}

	try {
		
		const idea = await Idea.findById(ideaId).select('title founder_id').lean();
		if (!idea) {
			return res.status(404).json({ success: false, message: 'Idea not found' });
		}

		
		let portfolio = await Portfolio.findOne({ investor_id: req.user._id });

		if (!portfolio) {
			portfolio = new Portfolio({
				investor_id:  req.user._id,
				investments:  []
			});
		}

		
		const alreadyCommitted = portfolio.investments.some(
			(inv) => inv.idea_id.toString() === ideaId
		);
		if (alreadyCommitted) {
			return res.status(409).json({
				success: false,
				message: 'You have already committed to this idea'
			});
		}

		
		portfolio.investments.push({
			idea_id:          ideaId,
			amount_committed: Number(amount),
			amount_released:  0,
			status:           'active'
		});

		await portfolio.save();

		
		await Investor.findByIdAndUpdate(req.user._id, {
			portfolio_id: portfolio._id
		});

		
		await incrementTrust(req.user._id, { history: 1 });

		
		if (idea.founder_id) {
			const investor = await Investor
				.findById(req.user._id)
				.select('name firm')
				.lean();

			const investorName = investor?.name || 'An investor';
			const firmSuffix   = investor?.firm ? ` (${investor.firm})` : '';

			await pushNotification(
				idea.founder_id,
				`${investorName}${firmSuffix} committed $${Number(amount).toLocaleString()} to your idea "${idea.title}"`
			);
		}

		publishInvestmentCommitted({
			investorId: req.user._id.toString(),
			ideaId:     ideaId,
			amount:     Number(amount),
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
				select: 'title stage tags founder_id author likes views'
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
				committed_at:     inv.committed_at
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



const withdraw = async (req, res) => {
	if (!assertInvestor(req, res)) return;

	const { investmentId } = req.params;

	try {
		const portfolio = await Portfolio.findOne({ investor_id: req.user._id });
		if (!portfolio) {
			return res.status(404).json({ success: false, message: 'Portfolio not found' });
		}

		const before = portfolio.investments.length;
		portfolio.investments = portfolio.investments.filter(
			(inv) => inv._id.toString() !== investmentId
		);

		if (portfolio.investments.length === before) {
			return res.status(404).json({ success: false, message: 'Investment not found' });
		}

		await portfolio.save();

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
	const { amount } = req.body;

	if (!mongoose.Types.ObjectId.isValid(investmentId)) {
		return res.status(400).json({ success: false, message: 'Invalid investment ID' });
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

		const releaseAmount = Number(amount);
		const remaining = investment.amount_committed - investment.amount_released;

		if (releaseAmount > remaining) {
			return res.status(400).json({
				success: false,
				message: `Cannot release more than the remaining committed amount ($${remaining.toLocaleString()})`,
			});
		}

		investment.amount_released += releaseAmount;

		
		if (investment.amount_released >= investment.amount_committed) {
			investment.status = 'released';
		}

		await portfolio.save();

		
		await incrementTrust(req.user._id, { escrowReleases: 1 });

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
				`${investorName}${firmSuffix} released $${releaseAmount.toLocaleString()} for "${idea.title}"`
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