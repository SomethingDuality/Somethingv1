// Leaderboards (community C4): what people back most, this week and all time. Counts only:
// nothing here says who supported or voted. Drafts, hidden and removed items never appear.
// No competition points (F10 is parked).
//   ideas, week:     supports given in the last 7 days
//   ideas, all:      all supports (Idea.likes)
//   problems, week:  the sum of votes cast in the last 7 days (an up is +1, a down -1)
//   problems, all:   the score

const { Idea } = require('../models/ideas.model.js');
const { Like } = require('../models/likes.model.js');
const { Problem } = require('../models/problem.model.js');
const { Vote } = require('../models/vote.model.js');
const { PUBLIC_IDEA, SHOWN } = require('../community/targets.js');
const cache = require('../utils/cache.js');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const TTL = { week: 120, all: 600 };
// Enough candidates that filtering out hidden items or other sectors still fills the list.
const CANDIDATES = 200;

const clampLimit = (n) => Math.min(Math.max(Number.parseInt(n, 10) || 5, 1), 25);

const ideaRow = (i, count) => ({ id: i._id, title: i.title, tags: i.tags || [], count });

const topIdeas = async ({ window, limit, sectors }) => {
	const sectorFilter = sectors.length ? { tags: { $in: sectors } } : {};
	if (window === 'all') {
		const ideas = await Idea.find({ ...PUBLIC_IDEA, ...sectorFilter, likes: { $gt: 0 } })
			.select('title tags likes').sort({ likes: -1, createdAt: -1 }).limit(limit).lean();
		return ideas.map((i) => ideaRow(i, i.likes));
	}
	const counts = await Like.aggregate([
		{ $match: { createdAt: { $gte: new Date(Date.now() - WEEK_MS) } } },
		{ $group: { _id: '$postID', n: { $sum: 1 } } },
		{ $sort: { n: -1, _id: -1 } },
		{ $limit: CANDIDATES },
	]);
	if (!counts.length) return [];
	const ideas = await Idea.find({ _id: { $in: counts.map((c) => c._id) }, ...PUBLIC_IDEA, ...sectorFilter })
		.select('title tags').lean();
	const byId = new Map(ideas.map((i) => [String(i._id), i]));
	return counts.filter((c) => byId.has(String(c._id))).slice(0, limit).map((c) => ideaRow(byId.get(String(c._id)), c.n));
};

const problemRow = (p, count) => ({ id: p._id, text: p.text, tags: p.tags || [], count });

const topProblems = async ({ window, limit }) => {
	if (window === 'all') {
		const problems = await Problem.find({ ...SHOWN, score: { $gt: 0 } })
			.select('text tags score').sort({ score: -1, createdAt: -1 }).limit(limit).lean();
		return problems.map((p) => problemRow(p, p.score));
	}
	const sums = await Vote.aggregate([
		{ $match: { targetType: 'problem', createdAt: { $gte: new Date(Date.now() - WEEK_MS) } } },
		{ $group: { _id: '$targetId', n: { $sum: '$value' } } },
		{ $match: { n: { $gt: 0 } } },
		{ $sort: { n: -1, _id: -1 } },
		{ $limit: CANDIDATES },
	]);
	if (!sums.length) return [];
	const problems = await Problem.find({ _id: { $in: sums.map((s) => s._id) }, ...SHOWN }).select('text tags').lean();
	const byId = new Map(problems.map((p) => [String(p._id), p]));
	return sums.filter((s) => byId.has(String(s._id))).slice(0, limit).map((s) => problemRow(byId.get(String(s._id)), s.n));
};

/** kind: ideas | problems; window: week | all; sectors only apply to ideas. Cached briefly. */
const leaderboard = async ({ kind, window, limit, sectors = [] }) => {
	const w = window === 'all' ? 'all' : 'week';
	const n = clampLimit(limit);
	const s = kind === 'ideas' ? [...new Set(sectors)].sort() : [];
	const key = `leaderboard:v1:${kind}:${w}:${n}:${s.join(',')}`;
	const cached = await cache.getJSON(key);
	if (cached) return cached;
	const rows = kind === 'problems' ? await topProblems({ window: w, limit: n }) : await topIdeas({ window: w, limit: n, sectors: s });
	await cache.setJSON(key, rows, TTL[w]);
	return rows;
};

module.exports = { leaderboard, clampLimit };
