// Side-effect handlers for domain events. They run in the Kafka consumer, or in-process
// when Kafka is disabled/unreachable (see events/index.js), so they must be idempotent.

const { Idea }             = require('../models/ideas.model.js');
const { pushNotification } = require('../services/notifications.service.js');

const handlers = {

    'comment.created': async ({ eventId, commentId, ideaId, authorId, authorName }) => {
        const idea = await Idea.findById(ideaId).select('founder_id title').lean();
        if (!idea || idea.founder_id.toString() === authorId) return;
        await pushNotification(
            idea.founder_id,
            `${authorName || 'Someone'} commented on “${idea.title}”`,
            { key: `comment.created:${commentId || eventId}` }
        );
    },

    // Downstream consumers (the Python agent service, recsys, search) index these.
    'idea.created': async ({ ideaId, founderId }) => {
        console.log(`[Events] idea.created: ${ideaId} by ${founderId}`);
    },
    'idea.updated': async ({ ideaId, changes = {} }) => {
        console.log(`[Events] idea.updated: ${ideaId}`, Object.keys(changes));
    },
    'idea.deleted': async ({ ideaId, founderId }) => {
        console.log(`[Events] idea.deleted: ${ideaId} by ${founderId}`);
    },

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

    // Consumed later by the agent service; nothing to do in Node.
    'profile.updated':   async () => {},
    'question.shown':    async () => {},
    'question.answered': async () => {},
    'question.rest':     async () => {},
    'question.skipped':  async () => {},
};

module.exports = handlers;
