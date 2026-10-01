// Who can see community content, and how each reportable type is handled (C1).
// One registry, so reports, the admin queue and the visibility rules agree on every type.

const { HIDDEN_STATES } = require('../models/moderation.schema.js');

const lazy = (path, name) => () => require(path)[name];
const IdeaModel    = lazy('../models/ideas.model.js', 'Idea');
const CommentModel = lazy('../models/comments.model.js', 'Comment');

/** Shown to people other than the author: not hidden and not removed (missing = visible). */
const isShown = (moderation) => !HIDDEN_STATES.includes(moderation?.state);

/** Mongo filter for ideas anyone may see in lists (discover, feed, watchlists, overlaps). */
const PUBLIC_IDEA = Object.freeze({ isDraft: false, 'moderation.state': { $nin: HIDDEN_STATES } });
const SHOWN = Object.freeze({ 'moderation.state': { $nin: HIDDEN_STATES } });

const sameId = (a, b) => Boolean(a) && Boolean(b) && String(a) === String(b);

/** Public, and not hidden: anyone may like it, comment on it, commit to it or save it. */
const isPublicIdea = (idea) => Boolean(idea) && !idea.isDraft && isShown(idea.moderation);

/** Drafts and hidden ideas are visible to their founder only; everyone else gets a 404. */
const canSeeIdea = (idea, userId) => Boolean(idea) && (sameId(idea.founder_id, userId) || isPublicIdea(idea));

/**
 * What an API response says about moderation: the author learns the state of their own item
 * (to show a banner); nobody else sees counts, flagged terms or anything at all.
 */
const moderationFor = (doc, ownerField, viewerId) =>
	sameId(doc?.[ownerField], viewerId) && HIDDEN_STATES.includes(doc?.moderation?.state)
		? { state: doc.moderation.state }
		: undefined;

const ProblemModel = lazy('../models/problem.model.js', 'Problem');
const MessageModel = lazy('../models/message.model.js', 'Message');
const ThreadModel  = lazy('../models/thread.model.js', 'Thread');

const excerpt = (s, n = 60) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');

/** Where an item lives: an idea (its page) or a problem (the board, opened on it). */
const placeOf = async (type, d) => {
	if (type === 'idea') return { kind: 'idea', id: d._id, title: d.title };
	if (type === 'problem') return { kind: 'problem', id: d._id, title: excerpt(d.text) };
	if (type === 'message') return { kind: 'chat', id: d.threadId, title: 'a private chat' };
	if (d.targetType === 'Problem') {
		const p = await ProblemModel().findById(d.postID).select('text').lean();
		return { kind: 'problem', id: d.postID, title: excerpt(p?.text) };
	}
	const idea = await IdeaModel().findById(d.postID).select('title').lean();
	return { kind: 'idea', id: d.postID, title: idea?.title || '' };
};

/** The page a notification about this place should open, for the person receiving it. */
const linkFor = (place, role) => {
	const r = String(role || '').toLowerCase() === 'investor' ? 'investor' : 'founder';
	if (place.kind === 'problem') return `/${r}/problems?p=${place.id}`;
	if (place.kind === 'chat') return `/${r}/chats?thread=${place.id}`;
	return r === 'investor' ? `/investor/search/${place.id}` : `/founder/ideas/${place.id}`;
};

/** A problem anyone may see: not hidden or removed. */
const isPublicProblem = (p) => Boolean(p) && isShown(p.moderation);

const TARGETS = {
	idea: {
		model:     IdeaModel,
		owner:     'founder_id',
		threshold: 5,
		select:    'title description founder_id isDraft moderation createdAt',
		snapshot:  (d) => `${d.title || ''}\n\n${d.description || ''}`.trim(),
		label:     (d, place) => `your idea “${place.title}”`,
		isPublic:  async (d) => isPublicIdea(d),
	},
	comment: {
		model:     CommentModel,
		owner:     'userId',
		threshold: 3,
		select:    'text userId postID targetType anonymous moderation createdAt',
		snapshot:  (d) => d.text || '',
		label:     (d, place) => place.kind === 'problem'
			? `your reply to “${place.title}”`
			: `your comment on “${place.title || 'an idea'}”`,
		// A comment is public when it is shown and what it replies to is public.
		isPublic:  async (d) => (d.targetType === 'Problem'
			? isPublicProblem(await ProblemModel().findById(d.postID).select('moderation').lean())
			: isPublicIdea(await IdeaModel().findById(d.postID).select('isDraft moderation').lean())),
	},
	problem: {
		model:     ProblemModel,
		owner:     'authorId',
		threshold: 3,
		select:    'text tags authorId anonymous moderation createdAt',
		snapshot:  (d) => d.text || '',
		label:     (d, place) => `your problem “${place.title}”`,
		isPublic:  async (d) => isPublicProblem(d),
	},
	// Chat messages (C5): only the other person in the chat can report one, and reports send it
	// to the admin queue without ever hiding it on their own.
	message: {
		model:     MessageModel,
		owner:     'senderId',
		threshold: Infinity,
		select:    'text senderId threadId kind moderation createdAt',
		snapshot:  (d) => d.text || '',
		label:     () => 'your message in a chat',
		isPublic:  async (d, viewerId) => d.kind === 'text' && isShown(d.moderation) && Boolean(viewerId)
			&& Boolean(await ThreadModel().exists({ _id: d.threadId, 'participants.userId': viewerId })),
	},
};

module.exports = {
	TARGETS, PUBLIC_IDEA, SHOWN, isShown, isPublicIdea, isPublicProblem, canSeeIdea, moderationFor, sameId, placeOf, linkFor,
};
