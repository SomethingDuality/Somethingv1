// Teams with invites (community C6). The rules:
// - Invites go out only from an active founder-to-founder chat about the inviter's own idea, to
//   the other person in that chat. Nobody types an email or an id.
// - Nobody is on a team until they accept. Accepting is atomic, so a double accept adds them
//   once, and the team itself is created once per idea (a unique index), even in parallel.
// - One open invite per idea and person; invites expire after 14 days.
// - The owner can remove members; members can leave; the owner can't leave their own team.

const mongoose = require('mongoose');
const { Team } = require('../models/team.model.js');
const { TeamInvite, INVITE_TTL_MS } = require('../models/teamInvite.model.js');
const { Thread } = require('../models/thread.model.js');
const { Idea } = require('../models/ideas.model.js');
const { BaseUser } = require('../models/user.model.js');
const { pushNotification } = require('./notifications.service.js');
const { sameId } = require('../community/targets.js');
const tax = require('../shared/taxonomy.js');

class TeamError extends Error {
	constructor(status, message, code) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const initials = (name) => String(name || '').trim().split(/\s+/).map((w) => w[0] || '').join('').toUpperCase().slice(0, 2);
const roleLabel = (role) => (tax.isKnown('roles', role) ? tax.labelFor('roles', role) : role);
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'Someone';

const cleanRole = (role) => {
	const raw = typeof role === 'string' ? role.trim() : '';
	if (!raw) throw new TeamError(400, 'Pick a role for them');
	const id = tax.normalize('roles', raw);
	const out = id && tax.isKnown('roles', id) ? id : raw.slice(0, 40);
	return out;
};

/** Invites nobody answered in 14 days end (checked whenever someone looks). */
const expireOld = () => TeamInvite.updateMany(
	{ status: 'pending', expiresAt: { $lt: new Date() } },
	{ $set: { status: 'expired', decidedAt: new Date() }, $unset: { openKey: '' } },
);

const chatEvent = (threadId, text) => require('../chat/chat.service.js').postEvent(threadId, text);

const inviteFromThread = async ({ user, threadId, role }) => {
	if (!validId(threadId)) throw new TeamError(404, 'Not found');
	const roleValue = cleanRole(role);
	const t = await Thread.findOne({ _id: threadId, 'participants.userId': oid(user._id) }).lean();
	if (!t) throw new TeamError(404, 'Not found');
	if (t.kind !== 'founder_founder' || t.status !== 'active') {
		throw new TeamError(409, 'Invites go out from an active chat with a founder who asked to join.', 'NOT_A_COFOUNDER_CHAT');
	}
	// The idea the chat is about must be yours: the person who asked to join is the one invited.
	const idea = await Idea.findById(t.context?.ideaId).select('title founder_id').lean();
	if (!idea || !sameId(idea.founder_id, user._id) || !sameId(t.recipientId, user._id)) {
		throw new TeamError(403, 'You can invite people only to your own idea.', 'NOT_YOUR_IDEA');
	}
	const inviteeId = t.requestedBy;
	const team = await Team.findOne({ idea_id: idea._id }).select('members.user_id').lean();
	if (team?.members?.some((m) => sameId(m.user_id, inviteeId))) {
		throw new TeamError(409, "They're already on the team.", 'ALREADY_MEMBER');
	}

	await expireOld();
	const openKey = `${idea._id}:${inviteeId}`;
	const open = await TeamInvite.findOne({ openKey }).lean();
	if (open) return { invite: await shapeInvite(open, user._id), existing: true };

	let invite;
	try {
		invite = (await TeamInvite.create({
			ideaId: idea._id, ideaTitle: idea.title, inviterId: user._id, inviteeId, threadId: t._id,
			role: roleValue, openKey, expiresAt: new Date(Date.now() + INVITE_TTL_MS),
		})).toObject();
	} catch (err) {
		if (err?.code !== 11000) throw err;
		return { invite: await shapeInvite(await TeamInvite.findOne({ openKey }).lean(), user._id), existing: true };
	}
	const [inviter, invitee] = await Promise.all([
		BaseUser.findById(user._id).select('name').lean(),
		BaseUser.findById(inviteeId).select('name').lean(),
	]);
	await chatEvent(t._id, `${inviter?.name || 'The founder'} invited ${firstName(invitee?.name)} to join the team as ${roleLabel(roleValue)}.`);
	await pushNotification(inviteeId, `${inviter?.name || 'A founder'} invited you to join “${idea.title}” as ${roleLabel(roleValue)}`, {
		key: `team-invite:${invite._id}`, link: '/founder/teams',
	});
	return { invite: await shapeInvite(invite, user._id), existing: false };
};

/** An invite as one side sees it: the other person's name, never user ids. */
const shapeInvite = async (inv, viewerId, names) => {
	const otherId = sameId(inv.inviterId, viewerId) ? inv.inviteeId : inv.inviterId;
	const name = names ? names.get(String(otherId)) : (await BaseUser.findById(otherId).select('name').lean())?.name;
	return {
		id:        inv._id,
		idea:      { id: inv.ideaId, title: inv.ideaTitle },
		role:      roleLabel(inv.role),
		status:    inv.status,
		direction: sameId(inv.inviterId, viewerId) ? 'outgoing' : 'incoming',
		other:     { name: name || 'Deleted account' },
		createdAt: inv.createdAt,
		expiresAt: inv.expiresAt,
	};
};

const listInvites = async ({ user, box }) => {
	await expireOld();
	const filter = box === 'outgoing'
		? { inviterId: oid(user._id) }
		: { inviteeId: oid(user._id), status: 'pending' };
	const rows = await TeamInvite.find(filter).sort({ createdAt: -1 }).limit(50).lean();
	const ids = [...new Set(rows.map((r) => String(sameId(r.inviterId, user._id) ? r.inviteeId : r.inviterId)))];
	const users = ids.length ? await BaseUser.find({ _id: { $in: ids } }).select('name').lean() : [];
	const names = new Map(users.map((u) => [String(u._id), u.name]));
	return Promise.all(rows.map((r) => shapeInvite(r, user._id, names)));
};

// The idea's team, created on first need. The unique index on idea_id makes parallel creates one.
const teamFor = async (idea, ownerId) => {
	const owner = await BaseUser.findById(ownerId).select('name').lean();
	const now = new Date();
	try {
		return await Team.findOneAndUpdate(
			{ idea_id: idea._id },
			{ $setOnInsert: {
				idea_id: idea._id, founder_id: ownerId, name: idea.title, investors: [],
				members: [{ user_id: ownerId, name: owner?.name || '', initials: initials(owner?.name), role: 'Founder', kind: 'owner', joinedAt: now, lastActive: now }],
			} },
			{ upsert: true, new: true },
		).lean();
	} catch (err) {
		if (err?.code !== 11000) throw err;
		return Team.findOne({ idea_id: idea._id }).lean();
	}
};

const decideInvite = async ({ user, inviteId, as, to }) => {
	if (!validId(inviteId)) throw new TeamError(404, 'Not found');
	const who = as === 'invitee' ? 'inviteeId' : 'inviterId';
	await expireOld();
	const inv = await TeamInvite.findOne({ _id: inviteId, [who]: oid(user._id) }).lean();
	if (!inv) throw new TeamError(404, 'Not found');
	// Conditional: only a pending invite changes, so a second click finds nothing to do.
	const r = await TeamInvite.updateOne(
		{ _id: inv._id, status: 'pending' },
		{ $set: { status: to, decidedAt: new Date() }, $unset: { openKey: '' } },
	);
	if (!r.modifiedCount) throw new TeamError(409, 'This invite is no longer open.', 'NOT_PENDING');
	return inv;
};

const accept = async ({ user, inviteId }) => {
	const inv = await decideInvite({ user, inviteId, as: 'invitee', to: 'accepted' });
	const idea = await Idea.findById(inv.ideaId).select('title founder_id').lean();
	if (!idea) throw new TeamError(404, 'This idea no longer exists.');
	const team = await teamFor(idea, idea.founder_id);
	const me = await BaseUser.findById(user._id).select('name').lean();
	const now = new Date();
	await Team.updateOne(
		{ _id: team._id, 'members.user_id': { $ne: oid(user._id) } },
		{ $push: { members: { user_id: user._id, name: me?.name || '', initials: initials(me?.name), role: roleLabel(inv.role), kind: 'member', joinedAt: now, lastActive: now } } },
	);
	await Promise.all([
		BaseUser.updateOne({ _id: user._id }, { $addToSet: { teams: team._id } }),
		BaseUser.updateOne({ _id: idea.founder_id }, { $addToSet: { teams: team._id, owned_teams: team._id } }),
	]);
	await chatEvent(inv.threadId, `${firstName(me?.name)} joined the team.`);
	await pushNotification(idea.founder_id, `${me?.name || 'Someone'} joined “${idea.title}” as ${roleLabel(inv.role)}`, {
		key: `team-joined:${inv._id}`, link: '/founder/teams',
	});
	return mine({ user });
};

const decline = async ({ user, inviteId }) => {
	await decideInvite({ user, inviteId, as: 'invitee', to: 'declined' });
	return { ok: true };
};

const revoke = async ({ user, inviteId }) => {
	await decideInvite({ user, inviteId, as: 'inviter', to: 'revoked' });
	return { ok: true };
};

const shapeTeam = (team, viewerId) => ({
	id:      team._id,
	idea:    { id: team.idea_id?._id || team.idea_id, title: team.idea_id?.title || team.name || '' },
	isOwner: sameId(team.founder_id, viewerId),
	members: (team.members || []).map((m) => ({
		// Teammates may know each other's ids (the owner needs one to remove a member).
		id:       m.user_id,
		name:     m.name || 'Team member',
		role:     m.role || '',
		kind:     sameId(m.user_id, team.founder_id) ? 'owner' : 'member',
		joinedAt: m.joinedAt || m.lastActive || null,
		isYou:    sameId(m.user_id, viewerId),
	})),
});

/** Every team you're on, as owner or member. */
const mine = async ({ user }) => {
	const teams = await Team.find({ 'members.user_id': oid(user._id) }).populate('idea_id', 'title').sort({ createdAt: -1 }).lean();
	return teams.map((t) => shapeTeam(t, user._id));
};

const teamForMember = async (teamId, userId) => {
	if (!validId(teamId)) throw new TeamError(404, 'Not found');
	const t = await Team.findOne({ _id: teamId, 'members.user_id': oid(userId) }).populate('idea_id', 'title').lean();
	if (!t) throw new TeamError(404, 'Not found');
	return t;
};

const getTeam = async ({ user, teamId }) => shapeTeam(await teamForMember(teamId, user._id), user._id);

const removeMember = async ({ user, teamId, memberId }) => {
	const t = await teamForMember(teamId, user._id);
	if (!sameId(t.founder_id, user._id)) throw new TeamError(403, 'Only the founder can remove people.', 'NOT_OWNER');
	if (!validId(memberId) || sameId(memberId, user._id)) throw new TeamError(400, "You can't remove yourself.");
	const r = await Team.updateOne({ _id: t._id }, { $pull: { members: { user_id: oid(memberId) } } });
	if (!r.modifiedCount) throw new TeamError(404, "They aren't on this team.");
	await BaseUser.updateOne({ _id: memberId }, { $pull: { teams: t._id } });
	await pushNotification(memberId, `You're no longer on the team for “${t.idea_id?.title || t.name}”.`, { link: '/founder/teams' });
	return shapeTeam(await teamForMember(t._id, user._id), user._id);
};

const leave = async ({ user, teamId }) => {
	const t = await teamForMember(teamId, user._id);
	if (sameId(t.founder_id, user._id)) throw new TeamError(400, "You founded this idea, so you can't leave its team.", 'OWNER_CANNOT_LEAVE');
	await Team.updateOne({ _id: t._id }, { $pull: { members: { user_id: oid(user._id) } } });
	await BaseUser.updateOne({ _id: user._id }, { $pull: { teams: t._id } });
	const me = await BaseUser.findById(user._id).select('name').lean();
	await pushNotification(t.founder_id, `${me?.name || 'Someone'} left the team for “${t.idea_id?.title || t.name}”.`, { link: '/founder/teams' });
	return { ok: true };
};

/** Account deletion: their invites go, sent or received. (Teams are handled by the caller.) */
const forgetInvites = (userId) => TeamInvite.deleteMany({ $or: [{ inviterId: oid(userId) }, { inviteeId: oid(userId) }] });

module.exports = {
	inviteFromThread, listInvites, accept, decline, revoke, mine, getTeam, removeMember, leave, forgetInvites, TeamError,
};
