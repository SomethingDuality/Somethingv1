const mongoose = require('mongoose');
const { Comment }  = require('../models/comments.model.js');
const { Idea }     = require('../models/ideas.model.js');
const { BaseUser } = require('../models/user.model.js');
const cache = require('../utils/cache.js');
const { emit } = require('../events/index.js');
const { SHOWN, canSeeIdea, isShown } = require('../community/targets.js');
const { HIDDEN_STATES } = require('../models/moderation.schema.js');
const { checkText, BLOCKED } = require('../community/filter.js');

// Mongo is the source of truth for comments. Redis only caches the shaped list per idea
// and is invalidated on every write; Kafka carries side effects (owner notification).

const MAX_COMMENT_LENGTH = 2000;
const CACHE_TTL_SECONDS  = 300;
// v2: timestamps became ISO strings (v1 lists held locale dates).
const cacheKey = (ideaId) => `comments:v2:${ideaId}`;

const shape = (c, authorName) => ({
	id:        c._id,
	author:    authorName || (c.userId && c.userId.name) || 'Anonymous',
	authorId:  c.userId && c.userId._id ? c.userId._id : c.userId,
	text:      c.text,
	// ISO: the app shows "2 h ago" from it (a locale date string had no time and the server's locale).
	timestamp: new Date(c.createdAt).toISOString(),
	// Only ever set on the author's own comment: others never receive hidden or removed ones.
	...(HIDDEN_STATES.includes(c.moderation?.state) && { hidden: c.moderation.state }),
});

// The idea, when this caller may see it (drafts and hidden ideas are the founder's only).
const visibleIdea = async (id, userId) => {
	const idea = await Idea.findById(id).select('founder_id isDraft moderation').lean();
	return canSeeIdea(idea, userId) ? idea : null;
};

const cleanText = (text) => (typeof text === 'string' ? text.trim() : '');

const get_comments = async (req, res) => {
	const { id } = req.params;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ success: false, message: 'Invalid idea ID' });
	}

	try {
		if (!(await visibleIdea(id, req.user?._id))) {
			return res.status(404).json({ success: false, message: 'Idea not found' });
		}

		// The shown list is the same for everyone, so it is what gets cached.
		let shaped = await cache.getJSON(cacheKey(id));
		if (!shaped) {
			const comments = await Comment.find({ postID: id, ...SHOWN })
				.populate('userId', 'name')
				.sort({ createdAt: 1 })
				.lean();
			shaped = comments.map((c) => shape(c));
			await cache.setJSON(cacheKey(id), shaped, CACHE_TTL_SECONDS);
		}

		// The author still sees their own hidden comments, marked, in place.
		if (req.user) {
			const own = await Comment.find({ postID: id, userId: req.user._id, 'moderation.state': { $in: HIDDEN_STATES } })
				.populate('userId', 'name').lean();
			if (own.length) {
				shaped = [...shaped, ...own.map((c) => ({ ...shape(c), createdAt: c.createdAt }))]
					.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
			}
		}

		return res.status(200).json({ success: true, comments: shaped });
	} catch (err) {
		console.error('get_comments:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const add_comment = async (req, res) => {
	const { id } = req.params;
	const user_id = req.user._id;
	const text = cleanText(req.body?.text);

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ success: false, message: 'Invalid idea ID' });
	}
	if (!text || text.length > MAX_COMMENT_LENGTH) {
		return res.status(400).json({ success: false, message: `Comment must be 1–${MAX_COMMENT_LENGTH} characters` });
	}

	const words = checkText(text);
	if (words.verdict === 'block') return res.status(400).json(BLOCKED);

	try {
		if (!(await visibleIdea(id, user_id))) return res.status(404).json({ success: false, message: 'Idea not found' });

		// The access token only carries {_id, role}, so the display name comes from the DB.
		const author = await BaseUser.findById(user_id).select('name').lean();

		const comment = await Comment.create({
			postID: id, userId: user_id, text,
			...(words.verdict === 'review' && { moderation: { needsReview: true, flaggedTerms: words.terms } }),
		});
		await Idea.updateOne({ _id: id }, { $inc: { comments: 1 } });
		await cache.del(cacheKey(id));

		emit('comment.created', id, {
			commentId:  comment._id.toString(),
			ideaId:     id,
			authorId:   user_id.toString(),
			authorName: author?.name,
		});

		return res.status(201).json({ success: true, comment: shape(comment.toObject(), author?.name) });
	} catch (err) {
		console.error('add_comment:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const update_comment = async (req, res) => {
	const { commentId } = req.params;
	const user_id = req.user._id;
	const text = cleanText(req.body?.text);

	if (!mongoose.Types.ObjectId.isValid(commentId)) {
		return res.status(400).json({ success: false, message: 'Invalid comment ID' });
	}
	if (!text || text.length > MAX_COMMENT_LENGTH) {
		return res.status(400).json({ success: false, message: `Comment must be 1–${MAX_COMMENT_LENGTH} characters` });
	}

	const words = checkText(text);
	if (words.verdict === 'block') return res.status(400).json(BLOCKED);

	try {
		// Idea comments only: problem replies have their own routes (and counters).
		const comment = await Comment.findOne({ _id: commentId, targetType: { $ne: 'Problem' } });
		if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

		if (comment.userId.toString() !== user_id.toString()) {
			return res.status(403).json({ success: false, message: 'Not authorized to edit this comment' });
		}

		comment.text = text;
		// An admin approved the old words, not these: reports count again.
		if (comment.moderation?.state === 'approved') comment.set('moderation.state', 'visible');
		if (words.verdict === 'review') {
			comment.set('moderation.needsReview', true);
			comment.set('moderation.flaggedTerms', words.terms);
		}
		await comment.save();
		await cache.del(cacheKey(comment.postID));

		return res.status(200).json({ success: true, comment: { id: comment._id, text: comment.text } });
	} catch (err) {
		console.error('update_comment:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const delete_comment = async (req, res) => {
	const { commentId } = req.params;
	const user_id = req.user._id;

	if (!mongoose.Types.ObjectId.isValid(commentId)) {
		return res.status(400).json({ success: false, message: 'Invalid comment ID' });
	}

	try {
		const comment = await Comment.findOne({ _id: commentId, targetType: { $ne: 'Problem' } }).lean();
		if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

		const idea = await Idea.findById(comment.postID).select('founder_id').lean();
		const isAuthor    = comment.userId.toString() === user_id.toString();
		const isIdeaOwner = idea && idea.founder_id.toString() === user_id.toString();
		if (!isAuthor && !isIdeaOwner) {
			return res.status(403).json({ success: false, message: 'Not authorized to delete this comment' });
		}

		const deleted = await Comment.deleteOne({ _id: commentId });
		// Hidden and removed comments were already taken off the counter.
		if (deleted.deletedCount === 1 && isShown(comment.moderation)) {
			await Idea.updateOne({ _id: comment.postID }, { $inc: { comments: -1 } });
		}
		await require('../models/report.model.js').Report.deleteMany({ targetType: 'comment', targetId: comment._id });
		await cache.del(cacheKey(comment.postID));

		return res.status(200).json({ success: true, message: 'Comment deleted' });
	} catch (err) {
		console.error('delete_comment:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

module.exports = { get_comments, add_comment, update_comment, delete_comment };
