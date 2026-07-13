const mongoose = require('mongoose');

const commentsSchema = new mongoose.Schema({
	postID: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Idea',
		required: true
	},
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'BaseUser',
		required: true
	},
	text: {
		type: String,
		required: true
	}
}, { timestamps: true });


commentsSchema.index({ postID: 1 });

const Comment = mongoose.model('Comment', commentsSchema);

module.exports = { Comment };
