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

const Like = mongoose.model('Like', likesSchema);

module.exports = { Like };
