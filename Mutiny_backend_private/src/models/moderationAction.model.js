const mongoose = require('mongoose');

// Audit log: every admin decision on community content, with the state before and after.
const moderationActionSchema = new mongoose.Schema({
	adminId:    { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser', required: true },
	targetType: { type: String, required: true },
	targetId:   { type: mongoose.Schema.Types.ObjectId, required: true },
	action:     { type: String, enum: ['restore', 'approve', 'remove'], required: true },
	from:       { type: String },
	to:         { type: String },
	note:       { type: String, default: '', maxlength: 300 },
}, { timestamps: true });

moderationActionSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

const ModerationAction = mongoose.model('ModerationAction', moderationActionSchema);

module.exports = { ModerationAction };
