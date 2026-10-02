const mongoose = require('mongoose');

// An invitation to join the team of one idea (community C6). Invites are sent only from an
// active founder-to-founder chat about the inviter's own idea, so nobody types an email or id.
// The invitee is not on the team until they accept.
const teamInviteSchema = new mongoose.Schema({
	ideaId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Idea', required: true },
	ideaTitle: { type: String, default: '' },
	inviterId: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser', required: true },
	inviteeId: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser', required: true },
	threadId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Thread' },
	// A role id from shared/taxonomy.json (cto, designer, …) or the inviter's own words.
	role:      { type: String, required: true, maxlength: 40 },
	status:    { type: String, enum: ['pending', 'accepted', 'declined', 'revoked', 'expired'], default: 'pending' },
	// Set only while pending: one open invite per idea and person. Unset (never null) when it ends.
	openKey:   { type: String },
	expiresAt: { type: Date, required: true },
	decidedAt: { type: Date, default: null },
}, { timestamps: true });

teamInviteSchema.index({ openKey: 1 }, { unique: true, sparse: true });
teamInviteSchema.index({ inviteeId: 1, status: 1 });
teamInviteSchema.index({ inviterId: 1, createdAt: -1 });
teamInviteSchema.index({ ideaId: 1 });
teamInviteSchema.index({ status: 1, expiresAt: 1 });

const TeamInvite = mongoose.model('TeamInvite', teamInviteSchema);

module.exports = { TeamInvite, INVITE_TTL_MS: 14 * 24 * 60 * 60 * 1000 };
