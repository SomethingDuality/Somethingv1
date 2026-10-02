const { Founder } = require('../models/user.model.js');
const uploads = require('../utils/uploads.js');
const { Idea }    = require('../models/ideas.model.js');
const { Team }    = require('../models/team.model.js');
const { Portfolio } = require('../models/portfolio.model.js');


const { applyUpdate, FieldError } = require('../profile/applyUpdate.js');
const tax = require('../shared/taxonomy.js');

const PROFILE_SELECT =
	'name email avatar plan ' +
	'headline location about socials ' +
	'skills interests work_experience education ' +
	'expertise experience_level occupation github linkedin ' +
	'profileCompletion isVerified githubVerified walletVerified ' +
	'fieldSources createdAt';


// Old signups stored linkedin/github/expertise at the top level; read them as fallbacks so
// nobody has to retype what they already gave us (scripts/migrate-profile-fields.js moves them).
const toProfileShape = (doc) => ({
	name:              doc.name              || '',
	email:             doc.email             || '',
	avatarUrl:         doc.avatar            || '',
	plan:              doc.plan              || 'free',
	headline:          doc.headline          || '',
	location:          doc.location          || '',
	about:             doc.about             || '',
	socials: {
		linkedin: doc.socials?.linkedin || doc.linkedin || '',
		twitter:  doc.socials?.twitter  || '',
		website:  doc.socials?.website  || '',
		github:   doc.socials?.github   || doc.github   || '',
	},
	skills:            tax.normalizeList('skills', [...(doc.skills || []), ...(doc.expertise || [])]),
	interests:         tax.normalizeList('sectors', doc.interests || []),
	experience_level:  doc.experience_level  || '',
	occupation:        doc.occupation        || '',
	experience:        doc.work_experience   || [],
	education:         doc.education         || [],
	isVerified:        doc.isVerified        || false,
	githubVerified:    doc.githubVerified     || false,
	walletVerified:    doc.walletVerified     || false,
	// Derived on every read, so it is right for new accounts and when the weights change.
	profileCompletion: computeCompletion(doc),
});


const computeCompletion = (doc) => {
	let score = 0;
	// Only what a founder can do today counts: GitHub/wallet verification is "Coming soon".
	// Same weights as getDynamicCompletion in frontend/app/founder/profile/page.tsx.
	if (doc.name)                               score += 20;
	if (doc.about && doc.about.length > 10)     score += 30;
	if (doc.work_experience?.length > 0)        score += 30;
	if (doc.education?.length > 0)              score += 20;
	return Math.min(score, 100);
};


const assertFounder = (req, res) => {
	if (req.user.role !== 'Founder') {
		res.status(403).json({ success: false, message: 'Founder account required' });
		return false;
	}
	return true;
};


const get_profile = async (req, res) => {
	if (!assertFounder(req, res)) return;

	try {
		const doc = await Founder
			.findById(req.user._id)
			.select(PROFILE_SELECT)
			.lean();

		if (!doc) {
			return res.status(404).json({ success: false, message: 'Profile not found' });
		}

		return res.status(200).json(toProfileShape(doc));
	} catch (err) {
		console.error('get_profile:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};




// Body fields map onto registry paths; everything is validated in profile/fields.js.
const FOUNDER_BODY_PATHS = {
	name: 'name', headline: 'headline', location: 'location', about: 'about',
	skills: 'skills', interests: 'interests', experience: 'work_experience', education: 'education',
	experience_level: 'experience_level', occupation: 'occupation',
};

const update_profile = async (req, res) => {
	if (!assertFounder(req, res)) return;

	const body = req.body || {};
	const patch = {};
	for (const [key, path] of Object.entries(FOUNDER_BODY_PATHS)) {
		if (body[key] !== undefined) patch[path] = body[key];
	}
	if (body.socials !== undefined) {
		if (!body.socials || typeof body.socials !== 'object' || Array.isArray(body.socials)) {
			return res.status(400).json({ success: false, message: 'socials must be an object' });
		}
		for (const k of ['linkedin', 'twitter', 'website', 'github']) {
			if (body.socials[k] !== undefined) patch[`socials.${k}`] = body.socials[k];
		}
	}

	if (Object.keys(patch).length === 0) {
		return res.status(400).json({ success: false, message: 'No valid fields provided' });
	}

	try {
		const doc = await applyUpdate({ userId: req.user._id, role: 'Founder', patch, source: 'profile' });
		if (!doc) return res.status(404).json({ success: false, message: 'Profile not found' });

		return res.status(200).json(toProfileShape(doc));
	} catch (err) {
		if (err instanceof FieldError) return res.status(422).json({ success: false, field: err.path, message: err.message });
		console.error('update_profile:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};




const update_avatar = async (req, res) => {
	if (!assertFounder(req, res)) {
		if (req.file) await uploads.removeStored(uploads.AVATARS_DIR, req.file.filename);
		return;
	}

	if (!req.file) {
		return res.status(400).json({ success: false, message: 'No file uploaded' });
	}

	const avatarUrl = `/uploads/avatars/${req.file.filename}`;

	try {
		const before = await Founder.findByIdAndUpdate(req.user._id, { avatar: avatarUrl }).select('avatar').lean();
		await uploads.removeAvatar(before?.avatar); // the old picture doesn't stay on disk

		return res.status(200).json({ success: true, avatarUrl });
	} catch (err) {
		await uploads.removeStored(uploads.AVATARS_DIR, req.file.filename);
		console.error('update_avatar:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};


const ACTIVITY_LIMIT = 10;
const quote = (s, n = 80) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const usd = (n) => `$${Number(n || 0).toLocaleString('en-US')}`;

// The founder's home: counts, per-idea money, the team and recent activity, all from real rows.
// Supports are shown without a name (Ghost Mode hides who looked or supported); comments are public and
// money reveals identity, so those carry names.
const get_overview = async (req, res) => {
	if (!assertFounder(req, res)) return;

	const founder_id = req.user._id;
	const me = String(founder_id);

	try {
		const { Like }    = require('../models/likes.model.js');
		const { Comment } = require('../models/comments.model.js');
		const { BaseUser } = require('../models/user.model.js');

		const [ideas, teams, user] = await Promise.all([
			Idea.find({ founder_id }).sort({ createdAt: -1 }).select('title stage tags isDraft likes views').lean(),
			Team.find({ founder_id }).select('idea_id members').lean(),
			Founder.findById(founder_id).select('notifications').lean(),
		]);
		const ideaIds = ideas.map((i) => i._id);
		const titleOf = new Map(ideas.map((i) => [String(i._id), i.title]));

		const [portfolios, likes, comments] = ideaIds.length ? await Promise.all([
			Portfolio.find({ 'investments.idea_id': { $in: ideaIds } }).select('investor_id investments').lean(),
			Like.find({ postID: { $in: ideaIds }, userId: { $ne: founder_id } }).sort({ createdAt: -1 }).limit(ACTIVITY_LIMIT).select('postID createdAt').lean(),
			Comment.find({ postID: { $in: ideaIds }, userId: { $ne: founder_id } }).sort({ createdAt: -1 }).limit(ACTIVITY_LIMIT)
				.populate('userId', 'name').select('postID userId text createdAt').lean(),
		]) : [[], [], []];

		// Money per idea, and who committed (for names in the activity).
		const perIdea = {};
		const investorIds = new Set();
		const moneyEvents = [];
		for (const p of portfolios) {
			for (const inv of p.investments) {
				const id = String(inv.idea_id);
				if (!titleOf.has(id)) continue;
				perIdea[id] ??= { committed: 0, released: 0, investors: 0 };
				perIdea[id].committed += inv.amount_committed || 0;
				perIdea[id].released  += inv.amount_released  || 0;
				perIdea[id].investors += 1;
				investorIds.add(String(p.investor_id));
				moneyEvents.push({ investor: String(p.investor_id), ideaId: id, inv });
			}
		}
		const names = new Map((await BaseUser.find({ _id: { $in: [...investorIds] } }).select('name').lean())
			.map((u) => [String(u._id), u.name || 'An investor']));

		const totals = Object.values(perIdea).reduce(
			(t, x) => ({ committed: t.committed + x.committed, released: t.released + x.released }),
			{ committed: 0, released: 0 },
		);

		// Everyone on the founder's teams, once each; the founder is listed as "You".
		const team = new Map();
		for (const t of teams) {
			for (const m of t.members) {
				const id = String(m.user_id);
				if (!team.has(id)) team.set(id, { id, name: m.name || 'Team member', initials: m.initials || '', role: m.role || '', isYou: id === me, joinedAt: m.lastActive || null, ideaId: String(t.idea_id) });
			}
		}

		const activity = [
			...likes.map((l) => ({ kind: 'like', ideaId: String(l.postID), at: l.createdAt,
				text: `Someone supported “${titleOf.get(String(l.postID))}”` })),
			...comments.map((c) => ({ kind: 'comment', ideaId: String(c.postID), at: c.createdAt,
				text: `${c.userId?.name || 'Someone'} commented on “${titleOf.get(String(c.postID))}”: ${quote(c.text)}` })),
			...moneyEvents.flatMap(({ investor, ideaId, inv }) => [
				{ kind: 'commit', ideaId, at: inv.committed_at,
					text: `${names.get(investor)} committed ${usd(inv.amount_committed)} to “${titleOf.get(ideaId)}”` },
				...(inv.releases || []).map((r) => ({ kind: 'release', ideaId, at: r.at,
					text: `${names.get(investor)} recorded a ${usd(r.amount)} release for “${titleOf.get(ideaId)}”` })),
			]),
			...[...team.values()].filter((m) => !m.isYou && m.joinedAt).map((m) => ({ kind: 'team', ideaId: m.ideaId, at: m.joinedAt,
				text: `${m.name} joined the team for “${titleOf.get(m.ideaId)}”${m.role ? ` as ${m.role}` : ''}` })),
		]
			.filter((a) => a.at)
			.sort((a, b) => new Date(b.at) - new Date(a.at))
			.slice(0, ACTIVITY_LIMIT)
			.map((a, i) => ({ id: `${a.kind}-${a.ideaId}-${new Date(a.at).getTime()}-${i}`, ...a }));

		const unread = (user?.notifications || []).filter((n) => !n.read).length;

		return res.status(200).json({
			kpis: {
				ideas:       ideas.length,
				teamMembers: [...team.values()].filter((m) => !m.isYou).length,
				fundsRaised: usd(totals.released),
				needsYou:    unread,
				unreadChats: unread, // old name; it was always the notification count
			},
			totals: { ...totals, investors: investorIds.size },
			ideas: ideas.slice(0, 5).map((idea) => ({
				id:        idea._id,
				title:     idea.title,
				status:    idea.isDraft ? 'Draft' : 'Seeking',
				stage:     idea.stage,
				tags:      idea.tags || [],
				likes:     idea.likes || 0,
				views:     idea.views || 0,
				committed: perIdea[String(idea._id)]?.committed || 0,
				released:  perIdea[String(idea._id)]?.released  || 0,
			})),
			committedByIdea: Object.fromEntries(Object.entries(perIdea).map(([id, x]) => [id, x.committed])),
			team: [...team.values()],
			activity,
			escrow: { raised: totals.released, goal: totals.committed },
		});
	} catch (err) {
		console.error('get_overview:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

// The founder's funding, idea by idea: who committed (money reveals identity), what each has
// released, and how much was released against each milestone. All of it is recorded intent:
// no money moves on Something yet.
const get_funding = async (req, res) => {
	if (!assertFounder(req, res)) return;
	try {
		const { Investor } = require('../models/user.model.js');
		const ideas = await Idea.find({ founder_id: req.user._id }).sort({ createdAt: -1 })
			.select('title tags stage isDraft milestones createdAt').lean();
		const ideaIds = ideas.map((i) => i._id);
		const portfolios = ideaIds.length
			? await Portfolio.find({ 'investments.idea_id': { $in: ideaIds } }).select('investor_id investments').lean()
			: [];
		const investors = new Map((await Investor.find({ _id: { $in: portfolios.map((p) => p.investor_id) } })
			.select('name firm avatar verification.status').lean())
			.map((u) => [String(u._id), u]));

		const byIdea = new Map(ideas.map((i) => [String(i._id), { committed: 0, released: 0, investors: [], releasedByMilestone: {} }]));
		for (const p of portfolios) {
			const who = investors.get(String(p.investor_id));
			for (const inv of p.investments) {
				const row = byIdea.get(String(inv.idea_id));
				if (!row) continue;
				row.committed += inv.amount_committed || 0;
				row.released  += inv.amount_released  || 0;
				row.investors.push({
					name:        who?.name || 'An investor',
					firm:        who?.firm || '',
					avatarUrl:   who?.avatar || '',
					verified:    who?.verification?.status === 'verified',
					committed:   inv.amount_committed || 0,
					released:    inv.amount_released  || 0,
					committedAt: inv.committed_at,
				});
				for (const r of inv.releases || []) {
					if (!r.milestone_id) continue;
					const k = String(r.milestone_id);
					row.releasedByMilestone[k] = (row.releasedByMilestone[k] || 0) + (r.amount || 0);
				}
			}
		}

		const out = ideas.map((i) => ({
			id:         i._id,
			title:      i.title,
			tags:       i.tags || [],
			stage:      i.stage || '',
			isDraft:    Boolean(i.isDraft),
			milestones: (i.milestones || []).map((m) => ({ id: m._id, title: m.title, status: m.status, doneAt: m.doneAt })),
			...byIdea.get(String(i._id)),
		}));
		const totals = out.reduce((t, x) => ({
			committed: t.committed + x.committed,
			released:  t.released + x.released,
			investors: t.investors + x.investors.length,
		}), { committed: 0, released: 0, investors: 0 });

		return res.status(200).json({ totals, ideas: out });
	} catch (err) {
		console.error('get_funding:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

module.exports = { get_profile, update_profile, update_avatar, get_overview, get_funding };
