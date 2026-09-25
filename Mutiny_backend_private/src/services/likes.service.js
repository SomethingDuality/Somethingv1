const mongoose = require('mongoose');
const { Idea } = require('../models/ideas.model.js');
const { Like } = require('../models/likes.model.js');

// Mongo is the source of truth for likes. The counter only moves when a Like row was
// actually inserted or deleted, so double-clicks and retries can't drift it.

class LikeError extends Error {
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}

const assertIdea = async (ideaId) => {
	if (!mongoose.Types.ObjectId.isValid(ideaId)) throw new LikeError(400, 'Invalid idea ID');
	const idea = await Idea.findById(ideaId).select('_id').lean();
	if (!idea) throw new LikeError(404, 'Idea not found');
};

const addLike = async (ideaId, userId) => {
	await assertIdea(ideaId);

	const result = await Like.updateOne(
		{ postID: ideaId, userId },
		{ $setOnInsert: { postID: ideaId, userId } },
		{ upsert: true }
	);

	if (result.upsertedCount === 0) {
		const current = await Idea.findById(ideaId).select('likes').lean();
		return { likes: current.likes, alreadyLiked: true };
	}

	const updated = await Idea.findByIdAndUpdate(ideaId, { $inc: { likes: 1 } }, { returnDocument: 'after' })
		.select('likes').lean();
	return { likes: updated.likes, alreadyLiked: false };
};

const removeLike = async (ideaId, userId) => {
	await assertIdea(ideaId);

	const deleted = await Like.deleteOne({ postID: ideaId, userId });
	if (deleted.deletedCount === 0) {
		const current = await Idea.findById(ideaId).select('likes').lean();
		return { likes: current.likes, alreadyUnliked: true };
	}

	const updated = await Idea.findByIdAndUpdate(ideaId, { $inc: { likes: -1 } }, { returnDocument: 'after' })
		.select('likes').lean();
	return { likes: Math.max(0, updated.likes), alreadyUnliked: false };
};

module.exports = { addLike, removeLike, LikeError };
