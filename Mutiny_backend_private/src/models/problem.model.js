const mongoose = require('mongoose');
const { moderationSchema } = require('./moderation.schema.js');

const MAX_PROBLEM_LENGTH = 280;
const MAX_PROBLEM_TAGS = 3;

// A problem someone has (C3): short, tagged with up to 3 sectors, voted up or down.
// `anonymous` hides the author from everyone; the API never sends author ids either way.
const problemSchema = new mongoose.Schema({
	authorId:      { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser', required: true },
	authorRole:    { type: String, enum: ['Founder', 'Investor'], required: true },
	anonymous:     { type: Boolean, default: false },
	text:          { type: String, required: true, maxlength: MAX_PROBLEM_LENGTH },
	tags:          { type: [String], default: [] }, // taxonomy sector ids
	upvotes:       { type: Number, default: 0, min: 0 },
	downvotes:     { type: Number, default: 0, min: 0 },
	score:         { type: Number, default: 0 },
	commentsCount: { type: Number, default: 0, min: 0 },
	moderation:    { type: moderationSchema, default: undefined },
}, { timestamps: true });

problemSchema.index({ createdAt: -1 });
problemSchema.index({ score: -1, createdAt: -1 });
problemSchema.index({ tags: 1, createdAt: -1 });
problemSchema.index({ authorId: 1 });
problemSchema.index({ 'moderation.state': 1 }, { sparse: true });
problemSchema.index({ 'moderation.needsReview': 1 }, { sparse: true });

const Problem = mongoose.model('Problem', problemSchema);

module.exports = { Problem, MAX_PROBLEM_LENGTH, MAX_PROBLEM_TAGS };
