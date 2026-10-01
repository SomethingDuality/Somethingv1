const mongoose = require('mongoose');
const { moderationSchema } = require('./moderation.schema.js');

const commentsSchema = new mongoose.Schema({
	// What it replies to: an idea (the default, and every comment from before C3) or a problem.
	targetType: { type: String, enum: ['Idea', 'Problem'], default: 'Idea' },
	postID: {
		type: mongoose.Schema.Types.ObjectId,
		refPath: 'targetType',
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
	},
	// Replies on problems can hide the writer's name, like the problem itself.
	anonymous: { type: Boolean, default: false },
	// Community moderation (C1); missing = visible.
	moderation: { type: moderationSchema, default: undefined }
}, { timestamps: true });


commentsSchema.index({ postID: 1 });
commentsSchema.index({ userId: 1 });
commentsSchema.index({ 'moderation.state': 1 }, { sparse: true });
commentsSchema.index({ 'moderation.needsReview': 1 }, { sparse: true });

const Comment = mongoose.model('Comment', commentsSchema);

module.exports = { Comment };
