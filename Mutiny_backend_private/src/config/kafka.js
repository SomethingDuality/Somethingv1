const { Kafka, logLevel } = require('kafkajs');

const KAFKA_ENABLED = process.env.KAFKA_ENABLED !== 'false';

const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'something-backend',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    logLevel: logLevel.WARN,
    retry: {
        initialRetryTime: 300,
        retries: 5,
    },
});

const TOPICS = {
    COMMENTS:          'comments',
    POST_INTERACTIONS: 'post_interactions',
    IDEAS:             'ideas',
    INVESTMENTS:       'investments',
    NOTIFICATIONS:     'notifications',
    PROFILE:           'profile',
    QUESTIONS:         'questions',
    COMMUNITY:         'community',
    CHATS:             'chats',
};

let producer   = null;
let connecting = null;

// Cache the producer only after connect() succeeds, so a failed first connect is retried
// on the next publish instead of leaving a broken instance around forever.
const getProducer = async () => {
    if (!KAFKA_ENABLED) return null;
    if (producer) return producer;
    if (connecting) return connecting;

    const candidate = kafka.producer({ allowAutoTopicCreation: true });
    connecting = candidate.connect()
        .then(() => {
            producer = candidate;
            console.log('[Kafka] Producer connected');
            return producer;
        })
        .finally(() => { connecting = null; });

    return connecting;
};

const disconnectProducer = async () => {
    if (producer) {
        await producer.disconnect().catch(() => {});
        producer = null;
        console.log('[Kafka] Producer disconnected');
    }
};

module.exports = { kafka, TOPICS, KAFKA_ENABLED, getProducer, disconnectProducer };
