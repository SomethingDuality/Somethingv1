// Up and down votes (problems today; C3). One row per person per item. The previous vote comes
// back from the same atomic write that replaces it, so the counters move by exactly the
// difference: switching from up to down is -1 up, +1 down, -2 score, and retries change nothing.

const mongoose = require('mongoose');
const { Vote } = require('../models/vote.model.js');
const { Problem } = require('../models/problem.model.js');
const { isPublicProblem, sameId } = require('../community/targets.js');

class VoteError extends Error {
	constructor(status, message, code) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

const TARGET_MODELS = { problem: () => Problem };
const OWNER = { problem: 'authorId' };

// Writes the vote and returns what it replaced (0 when there was none).
const swap = async (key, value) => {
	if (value === 0) {
		const prev = await Vote.findOneAndDelete(key).lean();
		return prev?.value || 0;
	}
	try {
		const prev = await Vote.findOneAndUpdate(key, { $set: { value } }, { upsert: true, new: false }).lean();
		return prev?.value || 0;
	} catch (err) {
		// Two first votes raced to insert: the row exists now, so update it like any other.
		if (err?.code !== 11000) throw err;
		const prev = await Vote.findOneAndUpdate(key, { $set: { value } }, { new: false }).lean();
		return prev?.value || 0;
	}
};

/** value: 1 (up), -1 (down) or 0 (take the vote back). Returns the new counts and the vote. */
const setVote = async ({ type, id, userId, value }) => {
	const model = TARGET_MODELS[type]?.();
	if (!model) throw new VoteError(400, 'Unknown type');
	if (!mongoose.Types.ObjectId.isValid(id)) throw new VoteError(400, 'Invalid ID');
	const v = Number(value);
	if (![1, -1, 0].includes(v)) throw new VoteError(400, 'value must be 1, -1 or 0');

	const item = await model.findById(id).select(`${OWNER[type]} moderation`).lean();
	if (!item || !isPublicProblem(item)) throw new VoteError(404, 'Not found');
	if (sameId(item[OWNER[type]], userId)) throw new VoteError(403, "You can't vote on your own post", 'OWN_POST');

	const prev = await swap({ targetType: type, targetId: id, userId }, v);
	const up = Number(v === 1) - Number(prev === 1);
	const down = Number(v === -1) - Number(prev === -1);
	const updated = up || down
		? await model.findByIdAndUpdate(id, { $inc: { upvotes: up, downvotes: down, score: v - prev } }, { new: true })
			.select('upvotes downvotes score').lean()
		: await model.findById(id).select('upvotes downvotes score').lean();
	return { upvotes: updated.upvotes, downvotes: updated.downvotes, score: updated.score, myVote: v };
};

/** Each listed item's vote by this person, as Map(id → 1 | -1). */
const myVotes = async (type, userId, ids) => {
	if (!userId || !ids.length) return new Map();
	const rows = await Vote.find({ targetType: type, userId, targetId: { $in: ids } }).select('targetId value').lean();
	return new Map(rows.map((r) => [String(r.targetId), r.value]));
};

/**
 * Account deletion: take each of the person's votes back off the counters, then delete them.
 */
const forgetVoter = async (userId) => {
	const rows = await Vote.find({ userId }).select('targetType targetId value').lean();
	for (const r of rows) {
		const model = TARGET_MODELS[r.targetType]?.();
		if (!model) continue;
		await model.updateOne({ _id: r.targetId }, {
			$inc: { upvotes: -Number(r.value === 1), downvotes: -Number(r.value === -1), score: -r.value },
		});
	}
	await Vote.deleteMany({ userId });
};

module.exports = { setVote, myVotes, forgetVoter, VoteError };
