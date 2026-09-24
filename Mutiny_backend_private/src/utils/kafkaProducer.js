const { getProducer, TOPICS } = require('../config/kafka.js');

/**
 * Internal helper — serialises and sends a single message.
 * Falls back silently so a Kafka hiccup never breaks an HTTP response.
 */
const publish = async (topic, eventType, payload) => {
    try {
        const producer = await getProducer();
        await producer.send({
            topic,
            messages: [
                {
                    key:   eventType,               // lets Kafka partition by event type
                    value: JSON.stringify({ eventType, ...payload }),
                },
            ],
        });
    } catch (err) {
        // Kafka is async-best-effort at this point; log and move on
        console.error(`[Kafka] Failed to publish ${eventType}:`, err.message);
    }
};


/**
 * @param {object} p
 * @param {string} p.commentId
 * @param {string} p.postId
 * @param {string} p.userId
 * @param {string} p.text
 * @param {string} p.author
 * @param {string} p.timestamp   ISO string
 */
const publishCommentAdded = (p) =>
    publish(TOPICS.COMMENTS, 'comment.added', p);

/**
 * @param {object} p
 * @param {string} p.commentId
 * @param {string} p.text        updated text
 */
const publishCommentUpdated = (p) =>
    publish(TOPICS.COMMENTS, 'comment.updated', p);

/**
 * @param {object} p
 * @param {string} p.commentId
 * @param {string} p.postId
 */
const publishCommentDeleted = (p) =>
    publish(TOPICS.COMMENTS, 'comment.deleted', p);


/**
 * @param {object} p
 * @param {string} p.postId
 * @param {string} p.userId
 * @param {'like'|'dislike'} p.action
 * @param {boolean} p.removed      true when a like/dislike was removed as a side-effect
 */
const publishPostInteraction = (p) =>
    publish(TOPICS.POST_INTERACTIONS, `post.${p.action}`, p);


/**
 * @param {object} p
 * @param {string} p.ideaId
 * @param {string} p.founderId
 * @param {string} p.title
 * @param {string} p.stage
 * @param {string[]} p.tags
 */
const publishIdeaCreated = (p) =>
    publish(TOPICS.IDEAS, 'idea.created', p);

/**
 * @param {object} p
 * @param {string} p.ideaId
 * @param {object} p.changes   key/value pairs of updated fields
 */
const publishIdeaUpdated = (p) =>
    publish(TOPICS.IDEAS, 'idea.updated', p);

/**
 * @param {object} p
 * @param {string} p.ideaId
 * @param {string} p.founderId
 */
const publishIdeaDeleted = (p) =>
    publish(TOPICS.IDEAS, 'idea.deleted', p);


/**
 * @param {object} p
 * @param {string} p.investorId
 * @param {string} p.ideaId
 * @param {number} p.amount
 */
const publishInvestmentCommitted = (p) =>
    publish(TOPICS.INVESTMENTS, 'investment.committed', p);

/**
 * @param {object} p
 * @param {string} p.investorId
 * @param {string} p.ideaId
 * @param {string} p.investmentId
 * @param {number} p.amount
 */
const publishInvestmentReleased = (p) =>
    publish(TOPICS.INVESTMENTS, 'investment.released', p);



/**
 * @param {object} p
 * @param {string} p.userId
 * @param {string} p.text
 */
const publishNotification = (p) =>
    publish(TOPICS.NOTIFICATIONS, 'notification.push', p);

module.exports = {
    publishCommentAdded,
    publishCommentUpdated,
    publishCommentDeleted,
    publishPostInteraction,
    publishIdeaCreated,
    publishIdeaUpdated,
    publishIdeaDeleted,
    publishInvestmentCommitted,
    publishInvestmentReleased,
    publishNotification,
};