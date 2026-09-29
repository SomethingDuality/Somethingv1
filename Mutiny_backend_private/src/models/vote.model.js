const mongoose = require('mongoose');

// One vote per person per item, +1 or -1 (problems today). Taking a vote back deletes the row.
// The item's counters are moved from the previous vote, so they always match these rows.
const voteSchema = new mongoose.Schema({
	targetType: { type: String, enum: ['problem'], required: true },
	targetId:   { type: mongoose.Schema.Types.ObjectId, required: true },
	userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser', required: true },
	value:      { type: Number, enum: [1, -1], required: true },
}, { timestamps: true });

voteSchema.index({ targetType: 1, targetId: 1, userId: 1 }, { unique: true });
voteSchema.index({ userId: 1 });
// This week's problems leaderboard sums votes by when they were cast.
voteSchema.index({ targetType: 1, createdAt: -1 });

const Vote = mongoose.model('Vote', voteSchema);

module.exports = { Vote };
