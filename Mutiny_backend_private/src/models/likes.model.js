const mongoose = require('mongoose');

const likesSchema = new mongoose.Schema({
	postID: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Idea',
		required: true
	},
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'BaseUser',
		required: true
	}
}, { timestamps: true });


likesSchema.index({ postID: 1, userId: 1 }, { unique: true });
// This week's leaderboard counts supports by when they were given.
likesSchema.index({ createdAt: -1 });

const Like = mongoose.model('Like', likesSchema);

module.exports = { Like };
