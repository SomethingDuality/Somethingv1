const mongoose = require('mongoose');

// What the Something box has asked a user, per question (and per idea for idea questions).
const questionStateSchema = new mongoose.Schema({
	userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser', required: true },
	questionId:   { type: String, required: true },
	entityId:     { type: mongoose.Schema.Types.ObjectId, default: null },
	status:       { type: String, enum: ['open', 'answered', 'skipped', 'snoozed', 'never'], default: 'open' },
	shownCount:   { type: Number, default: 0 },
	skipCount:    { type: Number, default: 0 },
	laterCount:   { type: Number, default: 0 },
	firstShownAt: Date,
	lastShownAt:  Date,
	lastSkippedAt: Date,
	answeredAt:   Date,
	snoozedUntil: Date,
	answeredVia:  { type: String, enum: ['box', 'profile', 'agent'] },
	lastContext:  String,
	// Room for the agent phase: confirm questions proposed by the Python service.
	origin:       { type: String, enum: ['bank', 'agent'], default: 'bank' },
	payload:      mongoose.Schema.Types.Mixed,
}, { timestamps: true });

questionStateSchema.index({ userId: 1, questionId: 1, entityId: 1 }, { unique: true });

const QuestionState = mongoose.model('QuestionState', questionStateSchema);

module.exports = { QuestionState };
