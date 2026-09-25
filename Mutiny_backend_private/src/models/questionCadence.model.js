const mongoose = require('mongoose');

// Per-user pacing for the Something box: one daily question, a few just-in-time ones, backoff.
const questionCadenceSchema = new mongoose.Schema({
	userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser', required: true, unique: true },
	timezone: { type: String, default: 'UTC' },
	daily: {
		day:        String,       // YYYY-MM-DD in the user's timezone
		questionId: String,
		entityId:   { type: mongoose.Schema.Types.ObjectId, default: null },
		resolved:   { type: Boolean, default: false },
	},
	jit: {
		day:   String,
		count: { type: Number, default: 0 },
	},
	consecutiveSkips: { type: Number, default: 0 },
	pausedUntil:      Date,
	totals: {
		shown:    { type: Number, default: 0 },
		answered: { type: Number, default: 0 },
		skipped:  { type: Number, default: 0 },
		never:    { type: Number, default: 0 },
	},
}, { timestamps: true });

const QuestionCadence = mongoose.model('QuestionCadence', questionCadenceSchema);

module.exports = { QuestionCadence };
