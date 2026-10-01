const { kafka, TOPICS, KAFKA_ENABLED, getProducer } = require('../config/kafka.js');
const handlers = require('../events/handlers.js');

const GROUP_ID = process.env.KAFKA_GROUP_ID || 'something-side-effects';
const SUBSCRIBED = Object.values(TOPICS);

let consumer = null;

// Create topics up front (3 partitions each) so the consumer never subscribes to a missing topic.
const ensureTopics = async () => {
    const admin = kafka.admin();
    await admin.connect();
    try {
        const existing = new Set(await admin.listTopics());
        const wanted = [...SUBSCRIBED, ...SUBSCRIBED.map((t) => `${t}.dlq`)]
            .filter((t) => !existing.has(t))
            .map((topic) => ({ topic, numPartitions: 3 }));
        if (wanted.length) await admin.createTopics({ topics: wanted });
    } finally {
        await admin.disconnect();
    }
};

// A failed message is parked on <topic>.dlq and the consumer moves on. Re-throwing used to
// make kafkajs retry the same poison message forever and stall every topic behind it.
const deadLetter = async (topic, message, reason) => {
    try {
        const producer = await getProducer();
        await producer.send({
            topic: `${topic}.dlq`,
            messages: [{
                key: message.key,
                value: message.value,
                headers: { reason: String(reason).slice(0, 500) },
            }],
        });
    } catch (err) {
        console.error(`[Kafka] DLQ write failed for ${topic}@${message.offset}:`, err.message);
    }
};

const startConsumer = async () => {
    if (!KAFKA_ENABLED) {
        console.log('[Kafka] disabled — events run in-process');
        return;
    }

    await ensureTopics();

    consumer = kafka.consumer({ groupId: GROUP_ID });
    await consumer.connect();
    await consumer.subscribe({ topics: SUBSCRIBED, fromBeginning: false });
    console.log('[Kafka] Consumer connected');

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            let event;
            try {
                event = JSON.parse(message.value.toString());
            } catch {
                await deadLetter(topic, message, 'unparseable JSON');
                return;
            }

            const handler = handlers[event.eventType];
            if (!handler) return;

            try {
                await handler(event);
            } catch (err) {
                console.error(
                    `[Kafka] ${event.eventType} failed (topic=${topic}, partition=${partition}, offset=${message.offset}):`,
                    err.message
                );
                await deadLetter(topic, message, err.message);
            }
        },
    });
};

const stopConsumer = async () => {
    if (!consumer) return;
    await consumer.disconnect().catch(() => {});
    consumer = null;
    console.log('[Kafka] Consumer disconnected');
};

module.exports = { startConsumer, stopConsumer };
