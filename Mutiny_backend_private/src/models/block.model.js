const mongoose = require('mongoose');

// "Block" in a chat: the blocked person can't start a new conversation with the blocker.
const blockSchema = new mongoose.Schema({
	blockerId: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser', required: true },
	blockedId: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser', required: true },
}, { timestamps: true });

blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
blockSchema.index({ blockedId: 1 });

const Block = mongoose.model('Block', blockSchema);

module.exports = { Block };
