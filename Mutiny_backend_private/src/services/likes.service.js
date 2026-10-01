const mongoose = require('mongoose');
const { Idea } = require('../models/ideas.model.js');
const { Like } = require('../models/likes.model.js');
const { isPublicIdea } = require('../community/targets.js');
const { emit } = require('../events/index.js');

// Mongo is the source of truth for likes. The counter only moves when a Like row was
// actually inserted or deleted, so double-clicks and retries can't drift it.

class LikeError extends Error {
	constructor(status, message, code) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

// The idea, checked. `forSupport`: it must be public (drafts and hidden ideas don't exist to
// anyone but the founder) and not the supporter's own.
const loadIdea = async (ideaId, userId, { forSupport = false } = {}) => {
	if (!mongoose.Types.ObjectId.isValid(ideaId)) throw new LikeError(400, 'Invalid idea ID');
	const idea = await Idea.findById(ideaId).select('_id founder_id isDraft moderation').lean();
	if (!idea || (forSupport && !isPublicIdea(idea))) throw new LikeError(404, 'Idea not found');
	if (forSupport && String(idea.founder_id) === String(userId)) {
		throw new LikeError(403, "You can't support your own idea", 'OWN_IDEA');
	}
	return idea;
};

const countOf = async (ideaId) => Math.max(0, (await Idea.findById(ideaId).select('likes').lean())?.likes || 0);

// Supporting is upvote-only (community plan: no downvotes on ideas). The count moves only when
// a row was really inserted, so double taps, retries and parallel requests count once.
const addLike = async (ideaId, userId) => {
	await loadIdea(ideaId, userId, { forSupport: true });

	let inserted = false;
	try {
		const result = await Like.updateOne(
			{ postID: ideaId, userId },
			{ $setOnInsert: { postID: ideaId, userId } },
			{ upsert: true }
		);
		inserted = result.upsertedCount === 1;
	} catch (err) {
		if (err?.code !== 11000) throw err; // a parallel duplicate lost the race: already supported
	}
	if (!inserted) return { likes: await countOf(ideaId), supportedByMe: true, alreadyLiked: true };

	const updated = await Idea.findByIdAndUpdate(ideaId, { $inc: { likes: 1 } }, { returnDocument: 'after' })
		.select('likes').lean();
	// The founder hears about milestones (1st, 10th…), never about each supporter.
	emit('idea.supported', String(ideaId), { ideaId: String(ideaId), count: updated.likes });
	return { likes: updated.likes, supportedByMe: true, alreadyLiked: false };
};

const removeLike = async (ideaId, userId) => {
	await loadIdea(ideaId, userId);

	const deleted = await Like.deleteOne({ postID: ideaId, userId });
	if (deleted.deletedCount === 0) {
		return { likes: await countOf(ideaId), supportedByMe: false, alreadyUnliked: true };
	}

	const updated = await Idea.findByIdAndUpdate(ideaId, { $inc: { likes: -1 } }, { returnDocument: 'after' })
		.select('likes').lean();
	return { likes: Math.max(0, updated.likes), supportedByMe: false, alreadyUnliked: false };
};

/** The ids among `ideaIds` this person supports, as a Set of strings. */
const supportedSet = async (userId, ideaIds) => {
	if (!userId || !ideaIds.length) return new Set();
	const rows = await Like.find({ userId, postID: { $in: ideaIds } }).select('postID').lean();
	return new Set(rows.map((r) => String(r.postID)));
};

module.exports = { addLike, removeLike, supportedSet, LikeError };
