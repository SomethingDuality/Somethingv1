const mongoose = require('mongoose');

// A conversation between two people about one idea (community C5).
// founder_investor: an investor wrote to a founder about their idea.
// founder_founder: a founder asked to join another founder's idea ("Ask to join").
//
// Ghost Mode: an investor's `ghost` is copied from their setting when the thread starts, so
// changing the setting later never changes an existing thread. Until `revealedAt` is set the
// founder only ever sees "Ghost investor" and a stage hint (see chat/serialize.js).
const participantSchema = new mongoose.Schema({
	userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser', required: true },
	role:       { type: String, enum: ['Founder', 'Investor'], required: true },
	ghost:      { type: Boolean, default: false },
	revealedAt: { type: Date, default: null },
	// What a founder may know about a ghost: the stages they invest in, nothing else.
	hint:       { stageFocus: { type: [String], default: undefined } },
	lastReadAt: { type: Date, default: null },
	unread:     { type: Number, default: 0, min: 0 },
}, { _id: false });

const threadSchema = new mongoose.Schema({
	kind:         { type: String, enum: ['founder_investor', 'founder_founder'], required: true },
	participants: { type: [participantSchema], validate: (v) => v.length === 2 },
	// The two user ids, sorted and joined, so a pair is easy to find either way round.
	pairKey:      { type: String, required: true },
	requestedBy:  { type: mongoose.Schema.Types.ObjectId, required: true },
	recipientId:  { type: mongoose.Schema.Types.ObjectId, required: true },
	context:      {
		ideaId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Idea' },
		ideaTitle: { type: String, default: '' },
	},
	// request: waiting for the recipient; active: talking; declined / expired / blocked: closed.
	status:       { type: String, enum: ['request', 'active', 'declined', 'expired', 'blocked'], default: 'request' },
	// Set only while the thread is open (request or active): one open thread per pair and idea.
	// Unset (never null) when it closes, so the unique index lets a new one start later.
	openKey:      { type: String },
	closedAt:     { type: Date, default: null },
	lastMessageAt:   { type: Date, default: Date.now },
	lastMessageText: { type: String, default: '' },
	lastMessageBy:   { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });

threadSchema.index({ openKey: 1 }, { unique: true, sparse: true });
threadSchema.index({ 'participants.userId': 1, lastMessageAt: -1 });
threadSchema.index({ pairKey: 1, status: 1 });
threadSchema.index({ requestedBy: 1, status: 1 });

const pairKeyOf = (a, b) => [String(a), String(b)].sort().join(':');

const Thread = mongoose.model('Thread', threadSchema);

module.exports = { Thread, pairKeyOf };
