const crypto = require('crypto');
const { TOPICS, KAFKA_ENABLED, getProducer } = require('../config/kafka.js');
const handlers = require('./handlers.js');

const TOPIC_BY_PREFIX = {
    comment:      TOPICS.COMMENTS,
    post:         TOPICS.POST_INTERACTIONS,
    idea:         TOPICS.IDEAS,
    investment:   TOPICS.INVESTMENTS,
    notification: TOPICS.NOTIFICATIONS,
    profile:      TOPICS.PROFILE,
    question:     TOPICS.QUESTIONS,
    problem:      TOPICS.COMMUNITY,
    chat:         TOPICS.CHATS,
};

const runLocally = (event) => {
    const handler = handlers[event.eventType];
    if (!handler) return;
    setImmediate(() => {
        handler(event).catch((err) =>
            console.error(`[Events] in-process ${event.eventType} failed:`, err.message)
        );
    });
};

/**
 * Publish a domain event. `key` is the entity id (ideaId, userId, ...) so every event for
 * one entity lands on one partition, in order. If Kafka is disabled or unreachable the
 * handler runs in-process, so side effects (notifications) still happen in local dev.
 * Never throws: an event failing must not fail the HTTP request that caused it.
 */
const emit = async (eventType, key, payload = {}) => {
    const event = {
        eventType,
        eventId:    crypto.randomUUID(),
        occurredAt: new Date().toISOString(),
        v:          1,
        ...payload,
    };

    const topic = TOPIC_BY_PREFIX[eventType.split('.')[0]];

    if (KAFKA_ENABLED && topic) {
        try {
            const producer = await getProducer();
            await producer.send({
                topic,
                messages: [{ key: String(key), value: JSON.stringify(event) }],
            });
            return;
        } catch (err) {
            console.error(`[Events] publish ${eventType} failed, running in-process:`, err.message);
        }
    }

    runLocally(event);
};

module.exports = { emit, TOPIC_BY_PREFIX };
