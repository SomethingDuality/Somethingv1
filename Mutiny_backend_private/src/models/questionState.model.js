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
	// Agent confirms (R12): "Stage: Prototype → MVP, right?" proposed by the Python service.
	// questionId is `agent:<confirmId>`; payload holds the prompt and the two values.
	origin:       { type: String, enum: ['bank', 'agent'], default: 'bank' },
	payload:      mongoose.Schema.Types.Mixed,
	expiresAt:    Date,
}, { timestamps: true });

questionStateSchema.index({ userId: 1, questionId: 1, entityId: 1 }, { unique: true });
questionStateSchema.index({ userId: 1, origin: 1, status: 1 });

const QuestionState = mongoose.model('QuestionState', questionStateSchema);

module.exports = { QuestionState };
