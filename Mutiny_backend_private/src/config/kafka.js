const { Kafka, logLevel } = require('kafkajs');

if (!process.env.KAFKA_BROKERS) {
    console.warn('[Kafka] KAFKA_BROKERS not set — defaulting to localhost:9092');
}

const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'mutiny-backend',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    logLevel: logLevel.WARN,
    retry: {
        initialRetryTime: 300,
        retries: 10,
    },
});

const TOPICS = {
    COMMENTS:          'comments',
    POST_INTERACTIONS: 'post_interactions',
    IDEAS:             'ideas',
    INVESTMENTS:       'investments',
    NOTIFICATIONS:     'notifications',
};

let producer = null;

const getProducer = async () => {
    if (producer) return producer;

    producer = kafka.producer({
        allowAutoTopicCreation: true,
        transactionTimeout: 30000,
    });

    await producer.connect();
    console.log('[Kafka] Producer connected');

    return producer;
};

const disconnectProducer = async () => {
    if (producer) {
        await producer.disconnect();
        producer = null;
        console.log('[Kafka] Producer disconnected');
    }
};

module.exports = { kafka, TOPICS, getProducer, disconnectProducer };