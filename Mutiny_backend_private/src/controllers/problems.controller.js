// The problems board (community C3): short posts about real problems, voted up or down and
// answered with replies. Shared by founders and investors.
//
// Privacy: responses never carry author ids. A problem or reply posted without a name says
// "anonymous" and nothing else; `isMine` tells the viewer which ones are theirs.

const mongoose = require('mongoose');
const { Problem, MAX_PROBLEM_LENGTH, MAX_PROBLEM_TAGS } = require('../models/problem.model.js');
const { Comment } = require('../models/comments.model.js');
const { Vote } = require('../models/vote.model.js');
const { Report } = require('../models/report.model.js');
const { BaseUser } = require('../models/user.model.js');
const { SHOWN, isShown, sameId } = require('../community/targets.js');
const { HIDDEN_STATES } = require('../models/moderation.schema.js');
const { checkText, BLOCKED } = require('../community/filter.js');
const { setVote, myVotes, VoteError } = require('../services/votes.service.js');
const { emit } = require('../events/index.js');
const tax = require('../shared/taxonomy.js');

const PAGE_SIZE = 20;
const MAX_PAGE = 50;
const MAX_REPLY_LENGTH = 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// What anyone may see: shown problems, plus the viewer's own hidden ones (with their state).
const visibleTo = (userId) => (userId
	? { $or: [SHOWN, { authorId: userId }] }
	: SHOWN);

const nameMap = async (docs, field) => {
	const ids = [...new Set(docs.filter((d) => !d.anonymous).map((d) => String(d[field])))];
	const users = ids.length ? await BaseUser.find({ _id: { $in: ids } }).select('name').lean() : [];
	return new Map(users.map((u) => [String(u._id), u.name || '']));
};

const shapeProblem = (p, { viewerId, names, votes }) => {
	const mine = sameId(p.authorId, viewerId);
	return {
		id:            p._id,
		text:          p.text,
		tags:          p.tags || [],
		createdAt:     p.createdAt,
		upvotes:       p.upvotes || 0,
		downvotes:     p.downvotes || 0,
		score:         p.score || 0,
		commentsCount: p.commentsCount || 0,
		anonymous:     Boolean(p.anonymous),
		// Only the name and role, never the id; nothing at all for an anonymous post.
		author:        p.anonymous ? null : { name: names.get(String(p.authorId)) || 'Deleted account', role: p.authorRole },
		isMine:        mine,
		myVote:        votes.get(String(p._id)) || 0,
		...(mine && HIDDEN_STATES.includes(p.moderation?.state) && { hidden: p.moderation.state }),
	};
};

const shapeReply = (c, { viewerId, names }) => {
	const mine = sameId(c.userId, viewerId);
	return {
		id:        c._id,
		text:      c.text,
		createdAt: c.createdAt,
		anonymous: Boolean(c.anonymous),
		author:    c.anonymous ? null : names.get(String(c.userId)) || 'Deleted account',
		isMine:    mine,
		...(mine && HIDDEN_STATES.includes(c.moderation?.state) && { hidden: c.moderation.state }),
	};
};

const fail = (res, err, label) => {
	if (err instanceof VoteError) {
		return res.status(err.status).json({ success: false, message: err.message, ...(err.code && { code: err.code }) });
	}
	console.error(`${label}:`, err);
	return res.status(500).json({ success: false, message: 'Internal server error' });
};

// GET /problems?sort=new|top&window=week|all&tag=<sector>&q=<text>&page=<n>
const list_problems = async (req, res) => {
	const sort = req.query.sort === 'top' ? 'top' : 'new';
	const week = req.query.window === 'week';
	const page = Math.min(Math.max(Number.parseInt(req.query.page, 10) || 1, 1), MAX_PAGE);
	const tag = typeof req.query.tag === 'string' ? tax.normalize('sectors', req.query.tag) : null;
	const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
	const viewerId = req.user?._id;

	const filter = {
		...visibleTo(viewerId),
		...(tag && { tags: tag }),
		...(q && { text: { $regex: escapeRegex(q), $options: 'i' } }),
		...(week && { createdAt: { $gte: new Date(Date.now() - WEEK_MS) } }),
	};
	try {
		const docs = await Problem.find(filter)
			.sort(sort === 'top' ? { score: -1, createdAt: -1 } : { createdAt: -1 })
			.skip((page - 1) * PAGE_SIZE)
			.limit(PAGE_SIZE + 1)
			.lean();
		const pageDocs = docs.slice(0, PAGE_SIZE);
		const [names, votes] = await Promise.all([
			nameMap(pageDocs, 'authorId'),
			myVotes('problem', viewerId, pageDocs.map((d) => d._id)),
		]);
		return res.status(200).json({
			problems: pageDocs.map((p) => shapeProblem(p, { viewerId, names, votes })),
			nextPage: docs.length > PAGE_SIZE ? page + 1 : null,
		});
	} catch (err) {
		return fail(res, err, 'list_problems');
	}
};

// GET /problems/:id (for ?p= links)
const get_problem = async (req, res) => {
	const { id } = req.params;
	if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
	const viewerId = req.user?._id;
	try {
		const p = await Problem.findOne({ _id: id, ...visibleTo(viewerId) }).lean();
		if (!p) return res.status(404).json({ success: false, message: 'Problem not found' });
		const [names, votes] = await Promise.all([nameMap([p], 'authorId'), myVotes('problem', viewerId, [p._id])]);
		return res.status(200).json(shapeProblem(p, { viewerId, names, votes }));
	} catch (err) {
		return fail(res, err, 'get_problem');
	}
};

// POST /problems { text, tags: [sector ids], anonymous }
const create_problem = async (req, res) => {
	const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
	if (!text) return res.status(400).json({ success: false, message: 'Write the problem first' });
	if (text.length > MAX_PROBLEM_LENGTH) {
		return res.status(400).json({ success: false, message: `Keep it under ${MAX_PROBLEM_LENGTH} characters` });
	}
	const rawTags = Array.isArray(req.body?.tags) ? req.body.tags : [];
	const tags = [...new Set(rawTags.map((t) => tax.normalize('sectors', String(t))).filter((t) => t && tax.isKnown('sectors', t)))];
	if (tags.length > MAX_PROBLEM_TAGS) {
		return res.status(400).json({ success: false, message: `Pick up to ${MAX_PROBLEM_TAGS} sectors` });
	}
	const words = checkText(text);
	if (words.verdict === 'block') return res.status(400).json(BLOCKED);

	try {
		const problem = await Problem.create({
			authorId:   req.user._id,
			authorRole: req.user.role,
			anonymous:  Boolean(req.body?.anonymous),
			text,
			tags,
			...(words.verdict === 'review' && { moderation: { needsReview: true, flaggedTerms: words.terms } }),
		});
		const p = problem.toObject();
		const names = await nameMap([p], 'authorId');
		return res.status(201).json(shapeProblem(p, { viewerId: req.user._id, names, votes: new Map() }));
	} catch (err) {
		return fail(res, err, 'create_problem');
	}
};

/**
 * Deletes a problem with its votes, replies and reports. Used by the author (DELETE) and by
 * account deletion. Deleting means deleting (P16).
 */
const purgeProblems = async (ids) => {
	if (!ids.length) return;
	const replyIds = (await Comment.find({ targetType: 'Problem', postID: { $in: ids } }).select('_id').lean()).map((c) => c._id);
	await Promise.all([
		Vote.deleteMany({ targetType: 'problem', targetId: { $in: ids } }),
		Report.deleteMany({ $or: [
			{ targetType: 'problem', targetId: { $in: ids } },
			{ targetType: 'comment', targetId: { $in: replyIds } },
		] }),
		Comment.deleteMany({ _id: { $in: replyIds } }),
	]);
	await Problem.deleteMany({ _id: { $in: ids } });
};

// DELETE /problems/:id (the author only)
const delete_problem = async (req, res) => {
	const { id } = req.params;
	if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
	try {
		const p = await Problem.findById(id).select('authorId').lean();
		if (!p) return res.status(404).json({ success: false, message: 'Problem not found' });
		if (!sameId(p.authorId, req.user._id)) return res.status(403).json({ success: false, message: 'Only the author can delete it' });
		await purgeProblems([p._id]);
		return res.status(200).json({ success: true });
	} catch (err) {
		return fail(res, err, 'delete_problem');
	}
};

// PUT /problems/:id/vote { value: 1 | -1 | 0 }
const vote_problem = async (req, res) => {
	try {
		const result = await setVote({ type: 'problem', id: req.params.id, userId: req.user._id, value: req.body?.value });
		return res.status(200).json({ success: true, ...result });
	} catch (err) {
		return fail(res, err, 'vote_problem');
	}
};

// GET /problems/trending-tags: the sectors people posted about most in the last two weeks.
const trending_tags = async (req, res) => {
	try {
		const rows = await Problem.aggregate([
			{ $match: { createdAt: { $gte: new Date(Date.now() - 2 * WEEK_MS) }, 'moderation.state': { $nin: HIDDEN_STATES } } },
			{ $unwind: '$tags' },
			{ $group: { _id: '$tags', count: { $sum: 1 } } },
			{ $sort: { count: -1, _id: 1 } },
			{ $limit: 8 },
		]);
		return res.status(200).json(rows.map((r) => ({ id: r._id, count: r.count })));
	} catch (err) {
		return fail(res, err, 'trending_tags');
	}
};

// GET /problems/:id/comments
const list_replies = async (req, res) => {
	const { id } = req.params;
	if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
	const viewerId = req.user?._id;
	try {
		const p = await Problem.findOne({ _id: id, ...visibleTo(viewerId) }).select('_id').lean();
		if (!p) return res.status(404).json({ success: false, message: 'Problem not found' });
		const replies = await Comment.find({
			targetType: 'Problem', postID: id,
			...(viewerId ? { $or: [SHOWN, { userId: viewerId }] } : SHOWN),
		}).sort({ createdAt: 1 }).limit(200).lean();
		const names = await nameMap(replies, 'userId');
		return res.status(200).json(replies.map((c) => shapeReply(c, { viewerId, names })));
	} catch (err) {
		return fail(res, err, 'list_replies');
	}
};

// POST /problems/:id/comments { text, anonymous }
const add_reply = async (req, res) => {
	const { id } = req.params;
	if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
	const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
	if (!text || text.length > MAX_REPLY_LENGTH) {
		return res.status(400).json({ success: false, message: `Replies are 1–${MAX_REPLY_LENGTH} characters` });
	}
	const words = checkText(text);
	if (words.verdict === 'block') return res.status(400).json(BLOCKED);
	try {
		const p = await Problem.findOne({ _id: id, ...SHOWN }).select('authorId').lean();
		if (!p) return res.status(404).json({ success: false, message: 'Problem not found' });
		const anonymous = Boolean(req.body?.anonymous);
		const reply = await Comment.create({
			targetType: 'Problem', postID: id, userId: req.user._id, text, anonymous,
			...(words.verdict === 'review' && { moderation: { needsReview: true, flaggedTerms: words.terms } }),
		});
		await Problem.updateOne({ _id: id }, { $inc: { commentsCount: 1 } });
		if (!sameId(p.authorId, req.user._id)) {
			emit('problem.replied', id, { problemId: id, replyId: String(reply._id), anonymous, authorId: String(req.user._id) });
		}
		const c = reply.toObject();
		const names = await nameMap([c], 'userId');
		return res.status(201).json(shapeReply(c, { viewerId: req.user._id, names }));
	} catch (err) {
		return fail(res, err, 'add_reply');
	}
};

// DELETE /problems/comments/:commentId (the reply's author, or the problem's author)
const delete_reply = async (req, res) => {
	const { commentId } = req.params;
	if (!mongoose.Types.ObjectId.isValid(commentId)) return res.status(400).json({ success: false, message: 'Invalid ID' });
	try {
		const c = await Comment.findOne({ _id: commentId, targetType: 'Problem' }).select('postID userId moderation').lean();
		if (!c) return res.status(404).json({ success: false, message: 'Reply not found' });
		const p = await Problem.findById(c.postID).select('authorId').lean();
		if (!sameId(c.userId, req.user._id) && !sameId(p?.authorId, req.user._id)) {
			return res.status(403).json({ success: false, message: 'Not allowed' });
		}
		const deleted = await Comment.deleteOne({ _id: commentId });
		// Hidden and removed replies were already taken off the count.
		if (deleted.deletedCount === 1 && isShown(c.moderation)) {
			await Problem.updateOne({ _id: c.postID, commentsCount: { $gt: 0 } }, { $inc: { commentsCount: -1 } });
		}
		await Report.deleteMany({ targetType: 'comment', targetId: c._id });
		return res.status(200).json({ success: true });
	} catch (err) {
		return fail(res, err, 'delete_reply');
	}
};

module.exports = {
	list_problems, get_problem, create_problem, delete_problem, vote_problem, trending_tags,
	list_replies, add_reply, delete_reply, purgeProblems,
};
