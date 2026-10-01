// Side-effect handlers for domain events. They run in the Kafka consumer, or in-process
// when Kafka is disabled/unreachable (see events/index.js), so they must be idempotent.

const { Idea }             = require('../models/ideas.model.js');
const { pushNotification } = require('../services/notifications.service.js');
const { BaseUser }         = require('../models/user.model.js');
const { linkFor }          = require('../community/targets.js');
const { forwardEvent }     = require('../agent/forward.js');

const excerpt = (s, n = 60) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');

const handlers = {

    'comment.created': async ({ eventId, commentId, ideaId, authorId, authorName }) => {
        const idea = await Idea.findById(ideaId).select('founder_id title').lean();
        if (!idea || idea.founder_id.toString() === authorId) return;
        await pushNotification(
            idea.founder_id,
            `${authorName || 'Someone'} commented on “${idea.title}”`,
            { key: `comment.created:${commentId || eventId}`, link: `/founder/ideas/${ideaId}` }
        );
    },

    // Support milestones only (1st, 10th, 25th, 50th, 100th), never one notification per
    // supporter: who supported stays private (Ghost Mode), and the founder isn't flooded.
    // The key makes each milestone fire once, even if supports drop and come back.
    'idea.supported': async ({ ideaId, count }) => {
        if (![1, 10, 25, 50, 100].includes(count)) return;
        const idea = await Idea.findById(ideaId).select('founder_id title').lean();
        if (!idea) return;
        const text = count === 1
            ? `Someone supports “${idea.title}”. That's your first supporter.`
            : `${count} people now support “${idea.title}”.`;
        await pushNotification(idea.founder_id, text, { key: `supports:${ideaId}:${count}`, link: `/founder/ideas/${ideaId}` });
    },

    // A reply on someone's problem. An anonymous reply stays "Someone" here too.
    'problem.replied': async ({ problemId, replyId, anonymous, authorId }) => {
        const { Problem } = require('../models/problem.model.js');
        const p = await Problem.findById(problemId).select('authorId authorRole text').lean();
        if (!p || String(p.authorId) === String(authorId)) return;
        const who = anonymous ? 'Someone' : (await BaseUser.findById(authorId).select('name').lean())?.name || 'Someone';
        await pushNotification(
            p.authorId,
            `${who} replied to your problem “${excerpt(p.text)}”`,
            { key: `problem-reply:${replyId}`, link: linkFor({ kind: 'problem', id: problemId }, p.authorRole) }
        );
    },

    // Chats (C5). Both handlers reload the thread instead of trusting the event, and name the
    // other person only as the receiver may see them: a ghost stays "Ghost investor".
    'chat.requested': async ({ threadId }) => {
        const { Thread } = require('../models/thread.model.js');
        const { otherParty, sides } = require('../chat/serialize.js');
        const { peopleFor } = require('../chat/chat.service.js');
        const t = await Thread.findById(threadId).lean();
        if (!t || t.status !== 'request') return;
        const to = t.recipientId;
        const other = otherParty(t, to, await peopleFor([t], to));
        const verb = t.kind === 'founder_founder' ? 'asked to join' : 'wants to talk about';
        const role = sides(t, to).me?.role === 'Investor' ? 'investor' : 'founder';
        await pushNotification(to, `${other.name} ${verb} “${t.context?.ideaTitle || 'your idea'}”`, {
            key: `chat-request:${threadId}`, link: `/${role}/chats?thread=${threadId}`,
        });
    },
    'chat.accepted': async ({ threadId }) => {
        const { Thread } = require('../models/thread.model.js');
        const { otherParty, sides } = require('../chat/serialize.js');
        const { peopleFor } = require('../chat/chat.service.js');
        const t = await Thread.findById(threadId).lean();
        if (!t || t.status !== 'active') return;
        const to = t.requestedBy;
        const other = otherParty(t, to, await peopleFor([t], to));
        const role = sides(t, to).me?.role === 'Investor' ? 'investor' : 'founder';
        await pushNotification(to, `${other.name} replied to you about “${t.context?.ideaTitle || 'their idea'}”`, {
            key: `chat-accepted:${threadId}`, link: `/${role}/chats?thread=${threadId}`,
        });
    },

    // The agent keeps its memory current from these (forward.js skips the agent's own writes).
    'idea.created': forwardEvent,
    'idea.updated': forwardEvent,
    'idea.deleted': forwardEvent,
    'idea.milestone_done': forwardEvent,
    'idea.update_posted': forwardEvent,
    'idea.attachment_added': forwardEvent,
    'idea.attachment_removed': forwardEvent,

    // Audit only — the portfolio write already happened in the controller.
    'investment.committed': async ({ investorId, ideaId, amount }) => {
        console.log(`[Events] investment.committed: investor=${investorId} idea=${ideaId} amount=${amount}`);
    },
    'investment.released': async ({ investorId, ideaId, amount }) => {
        console.log(`[Events] investment.released: investor=${investorId} idea=${ideaId} amount=${amount}`);
    },

    // Legacy messages still on the topic from before notifications were written directly.
    'notification.push': async ({ eventId, userId, text }) => {
        await pushNotification(userId, text, eventId ? { key: eventId } : {});
    },

    // Forwarded to the agent; nothing else to do in Node.
    'profile.updated':   forwardEvent,
    'question.shown':    async () => {},
    'question.answered': forwardEvent,
    'question.rest':     async () => {},
    'question.skipped':  async () => {},
};

module.exports = handlers;
