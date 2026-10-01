// Chats (community C5). The rules:
// - A chat is about one idea. Investors write to its founder; founders "ask to join" another
//   founder's idea. The recipient comes from the idea, never from the client.
// - One open thread per pair and idea (a unique `openKey`), so parallel starts make one thread.
// - A first message is a request: the requester can't write again until the recipient answers.
//   A reply from the recipient accepts it. Declines are quiet (no notification), with a 30-day
//   cooldown; unanswered requests expire after 30 days; at most 20 can wait at once.
// - First messages can't carry links. Words go through the community word filter.
// - Ghost Mode: an investor in Ghost Mode starts as "Ghost investor" unless this founder already
//   knows them (a chat where they shared their name, or a commitment). Sharing a name is
//   one-way and atomic, and committing money shares it too.
// - Retried sends with the same clientId land once.

const mongoose = require('mongoose');
const { Thread, pairKeyOf } = require('../models/thread.model.js');
const { Message, MAX_MESSAGE_LENGTH } = require('../models/message.model.js');
const { Block } = require('../models/block.model.js');
const { Idea } = require('../models/ideas.model.js');
const { BaseUser } = require('../models/user.model.js');
const { Portfolio } = require('../models/portfolio.model.js');
const { HIDDEN_STATES } = require('../models/moderation.schema.js');
const { isPublicIdea, sameId } = require('../community/targets.js');
const { checkText, BLOCKED } = require('../community/filter.js');
const { emit } = require('../events/index.js');
const { serializeThread, serializeMessage, visibleUserIds, sides } = require('./serialize.js');

const DAY_MS = 24 * 60 * 60 * 1000;
const REQUEST_TTL_MS = 30 * DAY_MS;
const DECLINE_COOLDOWN_MS = 30 * DAY_MS;
const MAX_PENDING = 20;
// Anything that looks like a link: a scheme, "www." or a bare domain.
const LINK_RE = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|in|io|co|net|org|app|dev|ai|me|link|xyz|ly|gg)\b/i;

class ChatError extends Error {
	constructor(status, message, code) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const validId = (id) => mongoose.Types.ObjectId.isValid(id);

const cleanText = (text) => {
	const body = typeof text === 'string' ? text.trim() : '';
	if (!body) throw new ChatError(400, 'Write a message first');
	if (body.length > MAX_MESSAGE_LENGTH) throw new ChatError(400, `Keep it under ${MAX_MESSAGE_LENGTH} characters`);
	const words = checkText(body);
	if (words.verdict === 'block') throw new ChatError(400, BLOCKED.message, BLOCKED.code);
	return { body, review: words.verdict === 'review' ? words.terms : null };
};

const cleanClientId = (clientId) => (typeof clientId === 'string' && clientId ? clientId.slice(0, 64) : undefined);

/** Names this viewer may see: never a ghost's (their account isn't even loaded). */
const peopleFor = async (threads, viewerId) => {
	const ids = visibleUserIds(threads, viewerId);
	const users = ids.length ? await BaseUser.find({ _id: { $in: ids } }).select('name firm').lean() : [];
	return new Map(users.map((u) => [String(u._id), { name: u.name, firm: u.firm }]));
};

const view = async (thread, viewerId) => serializeThread(thread, viewerId, await peopleFor([thread], viewerId));

/** Requests nobody answered for 30 days close (checked when either side looks). */
const expireOld = (userId) => Thread.updateMany(
	{ 'participants.userId': oid(userId), status: 'request', createdAt: { $lt: new Date(Date.now() - REQUEST_TTL_MS) } },
	{ $set: { status: 'expired', closedAt: new Date() }, $unset: { openKey: '' } },
);

/** The thread, if this user is in it; everyone else gets the same 404 as a missing thread. */
const threadFor = async (threadId, userId) => {
	if (!validId(threadId)) throw new ChatError(404, 'Not found');
	const t = await Thread.findOne({ _id: threadId, 'participants.userId': oid(userId) }).lean();
	if (!t) throw new ChatError(404, 'Not found');
	return t;
};

/** Has this founder already been told who the investor is? */
const alreadyNamedTo = async (investorId, founderId) => {
	const pairKey = pairKeyOf(investorId, founderId);
	const named = await Thread.exists({
		pairKey,
		participants: { $elemMatch: { userId: oid(investorId), $or: [{ ghost: false }, { revealedAt: { $ne: null } }] } },
	});
	if (named) return true;
	const ideaIds = (await Idea.find({ founder_id: founderId }).select('_id').lean()).map((i) => i._id);
	return ideaIds.length > 0 && Boolean(await Portfolio.exists({ investor_id: oid(investorId), 'investments.idea_id': { $in: ideaIds } }));
};

// Records activity on a thread: the latest line, and one more unread for everyone but `by`.
const touch = async (threadId, { text, by, at }) => {
	const set = { lastMessageAt: at, lastMessageText: text, lastMessageBy: by || null };
	if (by) {
		set['participants.$[me].lastReadAt'] = at;
		set['participants.$[me].unread'] = 0;
	}
	await Thread.updateOne(
		{ _id: threadId },
		{ $set: set, $inc: { 'participants.$[them].unread': 1 } },
		{ arrayFilters: by ? [{ 'me.userId': oid(by) }, { 'them.userId': { $ne: oid(by) } }] : [{ 'them.userId': { $exists: true } }] },
	);
};

const startThread = async ({ user, ideaId, text, clientId }) => {
	if (!validId(ideaId)) throw new ChatError(404, 'Idea not found');
	const { body, review } = cleanText(text);
	if (LINK_RE.test(body)) {
		throw new ChatError(400, 'Leave links out of a first message. You can share them once they reply.', 'LINK_IN_REQUEST');
	}

	const idea = await Idea.findById(ideaId).select('title founder_id isDraft moderation').lean();
	if (!isPublicIdea(idea)) throw new ChatError(404, 'Idea not found');
	const recipientId = idea.founder_id;
	if (sameId(recipientId, user._id)) throw new ChatError(400, 'This is your own idea');

	const [me, them] = await Promise.all([
		BaseUser.findById(user._id).select('role ghostMode stageFocus').lean(),
		BaseUser.findById(recipientId).select('role').lean(),
	]);
	if (!me || !them) throw new ChatError(404, 'Idea not found');
	const blocked = await Block.exists({ $or: [
		{ blockerId: recipientId, blockedId: oid(user._id) },
		{ blockerId: oid(user._id), blockedId: recipientId },
	] });
	if (blocked) throw new ChatError(403, "You can't message this person.", 'BLOCKED');

	const pairKey = pairKeyOf(user._id, recipientId);
	const openKey = `${pairKey}:${ideaId}`;
	await expireOld(user._id);
	const open = await Thread.findOne({ openKey }).lean();
	if (open) return { thread: await view(open, user._id), existing: true };

	// Quiet: the requester learns only that they asked recently, not that it was declined.
	const recent = await Thread.exists({
		pairKey, 'context.ideaId': oid(ideaId), requestedBy: oid(user._id), status: 'declined',
		closedAt: { $gt: new Date(Date.now() - DECLINE_COOLDOWN_MS) },
	});
	if (recent) throw new ChatError(429, 'You asked about this idea recently. You can ask again later.', 'COOLDOWN');
	if (await Thread.countDocuments({ requestedBy: oid(user._id), status: 'request' }) >= MAX_PENDING) {
		throw new ChatError(429, `You have ${MAX_PENDING} requests waiting. Wait for some replies first.`, 'TOO_MANY_PENDING');
	}

	const isInvestor = me.role === 'Investor';
	const ghost = isInvestor && me.ghostMode !== false && !(await alreadyNamedTo(user._id, recipientId));
	const now = new Date();
	let thread;
	try {
		thread = (await Thread.create({
			kind:         isInvestor ? 'founder_investor' : 'founder_founder',
			participants: [
				{ userId: user._id, role: me.role, ghost, ...(ghost && { hint: { stageFocus: me.stageFocus || [] } }), lastReadAt: now },
				{ userId: recipientId, role: them.role, unread: 1 },
			],
			pairKey, openKey,
			requestedBy:     user._id,
			recipientId,
			context:         { ideaId, ideaTitle: idea.title },
			lastMessageAt:   now,
			lastMessageText: body,
			lastMessageBy:   user._id,
		})).toObject();
	} catch (err) {
		if (err?.code !== 11000) throw err;
		// A parallel start won the race: that thread is the one.
		const t = await Thread.findOne({ openKey }).lean();
		return { thread: await view(t, user._id), existing: true };
	}
	await Message.create({
		threadId: thread._id, senderId: user._id, kind: 'text', text: body, clientId: cleanClientId(clientId),
		...(review && { moderation: { needsReview: true, flaggedTerms: review } }),
	});
	emit('chat.requested', String(thread._id), { threadId: String(thread._id) });
	return { thread: await view(thread, user._id), existing: false };
};

const sendMessage = async ({ user, threadId, text, clientId }) => {
	const t = await threadFor(threadId, user._id);
	const cid = cleanClientId(clientId);
	if (cid) {
		const dup = await Message.findOne({ threadId: t._id, senderId: oid(user._id), clientId: cid }).lean();
		if (dup) return { message: serializeMessage(dup, user._id), thread: await view(t, user._id) };
	}
	const { body, review } = cleanText(text);

	if (t.status === 'request') {
		if (sameId(t.requestedBy, user._id)) throw new ChatError(409, 'Wait for a reply first. You can write again once they answer.', 'WAITING');
		// The recipient's reply accepts the request.
		const accepted = await Thread.updateOne({ _id: t._id, status: 'request' }, { $set: { status: 'active' } });
		if (accepted.modifiedCount) emit('chat.accepted', String(t._id), { threadId: String(t._id) });
	} else if (t.status !== 'active') {
		throw new ChatError(409, 'This conversation is closed.', 'CLOSED');
	}

	let msg;
	try {
		msg = (await Message.create({
			threadId: t._id, senderId: user._id, kind: 'text', text: body, clientId: cid,
			...(review && { moderation: { needsReview: true, flaggedTerms: review } }),
		})).toObject();
	} catch (err) {
		if (err?.code !== 11000 || !cid) throw err;
		const dup = await Message.findOne({ threadId: t._id, senderId: oid(user._id), clientId: cid }).lean();
		return { message: serializeMessage(dup, user._id), thread: await view(t, user._id) };
	}
	await touch(t._id, { text: body, by: user._id, at: msg.createdAt });
	return { message: serializeMessage(msg, user._id), thread: await view(await Thread.findById(t._id).lean(), user._id) };
};

const accept = async ({ user, threadId }) => {
	const t = await threadFor(threadId, user._id);
	if (!sameId(t.recipientId, user._id) || t.status !== 'request') throw new ChatError(409, 'There is no request to accept here.');
	const r = await Thread.updateOne({ _id: t._id, status: 'request' }, { $set: { status: 'active' } });
	if (r.modifiedCount) emit('chat.accepted', String(t._id), { threadId: String(t._id) });
	return view(await Thread.findById(t._id).lean(), user._id);
};

const decline = async ({ user, threadId }) => {
	const t = await threadFor(threadId, user._id);
	if (!sameId(t.recipientId, user._id) || t.status !== 'request') throw new ChatError(409, 'There is no request to decline here.');
	await Thread.updateOne(
		{ _id: t._id, status: 'request' },
		{ $set: { status: 'declined', closedAt: new Date() }, $unset: { openKey: '' } },
	);
	return view(await Thread.findById(t._id).lean(), user._id);
};

const markRead = async ({ user, threadId }) => {
	const t = await threadFor(threadId, user._id);
	await Thread.updateOne(
		{ _id: t._id },
		{ $set: { 'participants.$[me].lastReadAt': new Date(), 'participants.$[me].unread': 0 } },
		{ arrayFilters: [{ 'me.userId': oid(user._id) }] },
	);
	return { ok: true };
};

// Shares an investor's name in one thread: atomic, so it happens once; then an event line.
const revealIn = async (threadId, investorId, eventText) => {
	const r = await Thread.updateOne(
		{ _id: threadId, participants: { $elemMatch: { userId: oid(investorId), ghost: true, revealedAt: null } } },
		{ $set: { 'participants.$.revealedAt': new Date() } },
	);
	if (!r.modifiedCount) return false;
	const m = await Message.create({ threadId, senderId: null, kind: 'event', text: eventText });
	await touch(threadId, { text: eventText, by: null, at: m.createdAt });
	return true;
};

/** A line from Something in a thread (an invite, a join), counted as new for both people. */
const postEvent = async (threadId, text) => {
	if (!threadId) return;
	const m = await Message.create({ threadId, senderId: null, kind: 'event', text });
	await touch(threadId, { text, by: null, at: m.createdAt });
};

const nameLine = async (investorId) => {
	const u = await BaseUser.findById(investorId).select('name firm').lean();
	return u ? `${u.name}${u.firm ? ` (${u.firm})` : ''}` : 'The investor';
};

const reveal = async ({ user, threadId, confirm }) => {
	if (confirm !== true) throw new ChatError(400, 'Confirm to share your name. It can\'t be taken back.', 'CONFIRM_REQUIRED');
	const t = await threadFor(threadId, user._id);
	const { me } = sides(t, user._id);
	if (!me?.ghost || me.revealedAt) throw new ChatError(409, 'Your name is already shown here.', 'ALREADY_SHOWN');
	const done = await revealIn(t._id, user._id, `${await nameLine(user._id)} shared their name.`);
	if (!done) throw new ChatError(409, 'Your name is already shown here.', 'ALREADY_SHOWN');
	return view(await Thread.findById(t._id).lean(), user._id);
};

/** Committing money names the investor: every ghost chat with that founder is revealed. */
const revealOnCommit = async ({ investorId, founderId, ideaTitle }) => {
	const threads = await Thread.find({
		pairKey: pairKeyOf(investorId, founderId),
		participants: { $elemMatch: { userId: oid(investorId), ghost: true, revealedAt: null } },
	}).select('_id').lean();
	if (!threads.length) return;
	const line = `${await nameLine(investorId)} committed to “${ideaTitle}”, so their name is now shown.`;
	for (const t of threads) await revealIn(t._id, investorId, line);
};

const block = async ({ user, threadId }) => {
	const t = await threadFor(threadId, user._id);
	const { other } = sides(t, user._id);
	if (!other) throw new ChatError(404, 'Not found');
	await Block.updateOne(
		{ blockerId: oid(user._id), blockedId: other.userId },
		{ $setOnInsert: { blockerId: oid(user._id), blockedId: other.userId } },
		{ upsert: true },
	).catch((err) => { if (err?.code !== 11000) throw err; });
	// Every open conversation between the two closes.
	await Thread.updateMany(
		{ pairKey: t.pairKey, status: { $in: ['request', 'active'] } },
		{ $set: { status: 'blocked', closedAt: new Date() }, $unset: { openKey: '' } },
	);
	return view(await Thread.findById(t._id).lean(), user._id);
};

const listThreads = async ({ user }) => {
	await expireOld(user._id);
	const threads = await Thread.find({ 'participants.userId': oid(user._id) }).sort({ lastMessageAt: -1 }).limit(200).lean();
	const people = await peopleFor(threads, user._id);
	return {
		threads: threads.map((t) => serializeThread(t, user._id, people)),
		lastActivityAt: threads[0]?.lastMessageAt || null,
	};
};

const getThread = async ({ user, threadId }) => view(await threadFor(threadId, user._id), user._id);

/** Messages, oldest first. `after` returns only newer ones (with a 2 s overlap; the client dedupes). */
const listMessages = async ({ user, threadId, after }) => {
	const t = await threadFor(threadId, user._id);
	const since = after && !Number.isNaN(Date.parse(after)) ? new Date(Date.parse(after) - 2000) : null;
	const msgs = await Message.find({
		threadId: t._id,
		...(since && { createdAt: { $gt: since } }),
		// Removed messages vanish for the other person; the sender still sees theirs.
		$or: [{ 'moderation.state': { $nin: HIDDEN_STATES } }, { senderId: oid(user._id) }],
	}).sort({ createdAt: 1 }).limit(500).lean();
	return msgs.map((m) => serializeMessage(m, user._id));
};

/** The counts the app shell polls (`/inbox/summary`). */
const chatSummary = async (userId) => {
	const threads = await Thread.find({ 'participants.userId': oid(userId) })
		.select('participants status recipientId lastMessageAt').sort({ lastMessageAt: -1 }).limit(500).lean();
	let unreadThreads = 0;
	let unreadMessages = 0;
	let incomingRequests = 0;
	for (const t of threads) {
		const { me } = sides(t, userId);
		if (t.status === 'request' && sameId(t.recipientId, userId)) incomingRequests++;
		if (me?.unread > 0 && ['active', 'request'].includes(t.status)) {
			unreadThreads++;
			unreadMessages += me.unread;
		}
	}
	return { unreadThreads, unreadMessages, incomingRequests, lastActivityAt: threads[0]?.lastMessageAt || null };
};

/** Account deletion: their conversations go, for both sides, with every message and block. */
const forgetChats = async (userId) => {
	const ids = (await Thread.find({ 'participants.userId': oid(userId) }).select('_id').lean()).map((t) => t._id);
	await Message.deleteMany({ $or: [{ threadId: { $in: ids } }, { senderId: oid(userId) }] });
	await Thread.deleteMany({ _id: { $in: ids } });
	await Block.deleteMany({ $or: [{ blockerId: oid(userId) }, { blockedId: oid(userId) }] });
};

module.exports = {
	startThread, sendMessage, accept, decline, markRead, reveal, revealOnCommit, block,
	listThreads, getThread, listMessages, chatSummary, forgetChats, ChatError, LINK_RE, peopleFor, postEvent,
};
