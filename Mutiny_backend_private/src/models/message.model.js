const mongoose = require('mongoose');
const { moderationSchema } = require('./moderation.schema.js');

// One message in a thread. `event` messages are written by the server (a reveal, an accept),
// with no sender. `clientId` makes a retried send land once.
const messageSchema = new mongoose.Schema({
	threadId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Thread', required: true },
	senderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser', default: null },
	kind:       { type: String, enum: ['text', 'event'], default: 'text' },
	text:       { type: String, required: true, maxlength: 2000 },
	clientId:   { type: String, maxlength: 64 },
	moderation: { type: moderationSchema, default: undefined },
}, { timestamps: true });

messageSchema.index({ threadId: 1, createdAt: 1 });
messageSchema.index(
	{ threadId: 1, senderId: 1, clientId: 1 },
	{ unique: true, partialFilterExpression: { clientId: { $type: 'string' } } },
);
messageSchema.index({ senderId: 1 });
messageSchema.index({ 'moderation.needsReview': 1 }, { sparse: true });

const Message = mongoose.model('Message', messageSchema);

module.exports = { Message, MAX_MESSAGE_LENGTH: 2000 };
