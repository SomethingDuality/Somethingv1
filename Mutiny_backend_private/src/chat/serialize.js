// What a chat looks like to one viewer (community C5). Pure functions: no database, no I/O, so
// the Ghost Mode rules are tested directly (test/unit/serialize.test.js).
//
// Ghost Mode: while an investor is a ghost in a thread and hasn't shared their name, the
// founder's view says "Ghost investor" and shows the stages they invest in. The investor's
// account is never looked up for that view, so no name, firm, email or id can leak, even by
// mistake. Responses never carry user ids at all; `mine` tells the viewer which side is theirs.

const tax = require('../shared/taxonomy.js');

const sameId = (a, b) => Boolean(a) && Boolean(b) && String(a) === String(b);

/** The viewer's own participant entry, and the other person's. */
const sides = (thread, viewerId) => {
	const me = thread.participants.find((p) => sameId(p.userId, viewerId)) || null;
	const other = thread.participants.find((p) => !sameId(p.userId, viewerId)) || null;
	return { me, other };
};

/** True while this participant's name must stay hidden from the other person. */
const isHidden = (p) => Boolean(p?.ghost) && !p?.revealedAt;

/** The user ids whose names this viewer is allowed to see (ghosts left out on purpose). */
const visibleUserIds = (threads, viewerId) => {
	const ids = new Set();
	for (const t of threads) {
		const { other } = sides(t, viewerId);
		if (other && !isHidden(other)) ids.add(String(other.userId));
	}
	return [...ids];
};

const stageHint = (stageFocus = []) => {
	const labels = stageFocus.map((s) => tax.labelFor('fundingStages', s)).filter(Boolean);
	return labels.length ? `Invests at ${labels.slice(0, 3).join(', ')}` : 'Stages not shared yet';
};

/** The other person, as this viewer may see them. `people`: Map(id → { name, firm }). */
const otherParty = (thread, viewerId, people) => {
	const { other } = sides(thread, viewerId);
	if (!other) return { name: 'Deleted account', role: null, ghost: false };
	if (isHidden(other)) {
		return { name: 'Ghost investor', role: 'Investor', ghost: true, hint: stageHint(other.hint?.stageFocus) };
	}
	const p = people.get(String(other.userId));
	return {
		name:  p?.name || 'Deleted account',
		role:  other.role,
		ghost: false,
		...(other.role === 'Investor' && p?.firm && { firm: p.firm }),
	};
};

/**
 * The thread's state from this viewer's side.
 *   request_in:  someone asked you; reply or accept to start, or decline
 *   request_out: you asked; waiting for a reply (you can't send again until they answer)
 *   active:      talking
 *   closed:      declined, expired or blocked. A requester whose request was declined sees
 *                "no reply", like an expired one: declines are quiet.
 */
const viewerStatus = (thread, viewerId) => {
	if (thread.status === 'active') return 'active';
	if (thread.status === 'request') return sameId(thread.recipientId, viewerId) ? 'request_in' : 'request_out';
	return 'closed';
};

const closedNote = (thread, viewerId) => {
	if (thread.status === 'blocked') return 'This conversation is closed.';
	if (sameId(thread.requestedBy, viewerId)) return 'No reply. You can ask again later.';
	return thread.status === 'declined' ? 'You declined this request.' : 'This request expired.';
};

/** Can the viewer send right now, and if not, why (shown in place of the composer). */
const sendState = (thread, viewerId, otherName) => {
	const status = viewerStatus(thread, viewerId);
	if (status === 'active' || status === 'request_in') return { canSend: true, reason: null };
	if (status === 'request_out') return { canSend: false, reason: `Waiting for ${otherName} to reply. You can write again once they do.` };
	return { canSend: false, reason: closedNote(thread, viewerId) };
};

const excerpt = (s, n = 90) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');

const serializeThread = (thread, viewerId, people) => {
	const { me } = sides(thread, viewerId);
	const other = otherParty(thread, viewerId, people);
	return {
		id:      thread._id,
		kind:    thread.kind,
		status:  viewerStatus(thread, viewerId),
		other,
		context: { ideaId: thread.context?.ideaId || null, ideaTitle: thread.context?.ideaTitle || '' },
		lastMessage: thread.lastMessageText
			? { text: excerpt(thread.lastMessageText), at: thread.lastMessageAt, mine: sameId(thread.lastMessageBy, viewerId) }
			: null,
		unread:  me?.unread || 0,
		// For an investor: whether they are a ghost in this thread, and can still share their name.
		me:      { ghost: isHidden(me), canReveal: isHidden(me) },
		// C6: the founder whose idea this co-founder chat is about can invite the other person.
		canInvite: thread.kind === 'founder_founder' && thread.status === 'active' && sameId(thread.recipientId, viewerId),
		...sendState(thread, viewerId, other.name),
		updatedAt: thread.lastMessageAt,
	};
};

const serializeMessage = (m, viewerId) => ({
	id:       m._id,
	kind:     m.kind,
	text:     m.text,
	at:       m.createdAt,
	mine:     m.kind === 'text' && sameId(m.senderId, viewerId),
	...(m.clientId && sameId(m.senderId, viewerId) && { clientId: m.clientId }),
});

module.exports = { sides, isHidden, visibleUserIds, otherParty, viewerStatus, serializeThread, serializeMessage, stageHint };
