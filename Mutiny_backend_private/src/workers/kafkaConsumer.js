const { kafka, TOPICS } = require('../config/kafka.js');
const { Comment }       = require('../models/comments.model.js');
const { Like }          = require('../models/likes.model.js');
const { Idea }          = require('../models/ideas.model.js');
const { Portfolio }     = require('../models/portfolio.model.js');
const { BaseUser }      = require('../models/user.model.js');

const GROUP_ID = process.env.KAFKA_GROUP_ID || 'mutiny-db-sync';

// ─── Handlers ─────────────────────────────────────────────────────────────────

const handlers = {

    // ── Comments ──────────────────────────────────────────────────────────────

    'comment.added': async ({ commentId, postId, userId, text, timestamp }) => {
        // Upsert so replaying the same event is idempotent
        await Comment.updateOne(
            { _id: commentId },
            {
                $setOnInsert: {
                    _id:       commentId,
                    postID:    postId,
                    userId:    userId,
                    text:      text,
                    createdAt: timestamp ? new Date(timestamp) : new Date(),
                    updatedAt: timestamp ? new Date(timestamp) : new Date(),
                },
            },
            { upsert: true }
        );

        // Keep the comment counter in sync
        await Idea.findByIdAndUpdate(postId, { $inc: { comments: 1 } });
    },

    'comment.updated': async ({ commentId, text }) => {
        await Comment.findByIdAndUpdate(commentId, {
            $set: { text, updatedAt: new Date() },
        });
    },

    'comment.deleted': async ({ commentId, postId }) => {
        const deleted = await Comment.findByIdAndDelete(commentId);
        if (deleted) {
            await Idea.findByIdAndUpdate(postId, { $inc: { comments: -1 } });
        }
    },

    // ── Post interactions ─────────────────────────────────────────────────────

    'post.like': async ({ postId, userId, removed }) => {
        if (removed) {
            // The like was displaced by a dislike — remove it from DB too
            const del = await Like.deleteOne({ postID: postId, userId });
            if (del.deletedCount > 0) {
                await Idea.findByIdAndUpdate(postId, { $inc: { likes: -1 } });
            }
            return;
        }

        const result = await Like.updateOne(
            { postID: postId, userId },
            { $setOnInsert: { postID: postId, userId } },
            { upsert: true }
        );

        if (result.upsertedCount > 0) {
            await Idea.findByIdAndUpdate(postId, { $inc: { likes: 1 } });
        }
    },

    'post.dislike': async ({ postId, userId, removed }) => {
        if (removed) {
            // The dislike was displaced by a like — mirror the removal
            await Idea.findByIdAndUpdate(postId, { $inc: { likes: -1 } });
            return;
        }

        // Dislikes are tracked only in Redis for now; just ensure the like is gone from DB
        const del = await Like.deleteOne({ postID: postId, userId });
        if (del.deletedCount > 0) {
            await Idea.findByIdAndUpdate(postId, { $inc: { likes: -1 } });
        }
    },

    // ── Ideas ─────────────────────────────────────────────────────────────────

    'idea.created': async ({ ideaId, founderId, title, stage, tags }) => {
        // No-op for now: the idea is already written by the controller.
        // This event exists for downstream consumers (recsys, search index, etc.)
        // to pick up and index new content without coupling to the HTTP layer.
        console.log(`[Kafka] idea.created: ${ideaId} by ${founderId}`);
    },

    'idea.updated': async ({ ideaId, changes }) => {
        // Same pattern — downstream services react to field changes.
        console.log(`[Kafka] idea.updated: ${ideaId}`, Object.keys(changes));
    },

    'idea.deleted': async ({ ideaId, founderId }) => {
        console.log(`[Kafka] idea.deleted: ${ideaId} by ${founderId}`);
    },

    // ── Investments ───────────────────────────────────────────────────────────

    'investment.committed': async ({ investorId, ideaId, amount }) => {
        // Audit log — the portfolio write already happened in the controller.
        // Add escrow / ledger writes here once that layer exists.
        console.log(`[Kafka] investment.committed: investor=${investorId} idea=${ideaId} amount=${amount}`);
    },

    'investment.released': async ({ investorId, ideaId, investmentId, amount }) => {
        console.log(`[Kafka] investment.released: investor=${investorId} idea=${ideaId} amount=${amount}`);
    },

    // ── Notifications ─────────────────────────────────────────────────────────

    'notification.push': async ({ userId, text }) => {
        await BaseUser.findByIdAndUpdate(
            userId,
            { $push: { notifications: { text, timestamp: new Date() } } }
        );
    },
};

// ─── Consumer bootstrap ───────────────────────────────────────────────────────

const consumer = kafka.consumer({ groupId: GROUP_ID });

const startConsumer = async () => {
    await consumer.connect();
    console.log('[Kafka] Consumer connected');

    await consumer.subscribe({
        topics: [TOPICS.COMMENTS, TOPICS.POST_INTERACTIONS, TOPICS.IDEAS, TOPICS.INVESTMENTS, TOPICS.NOTIFICATIONS],
        fromBeginning: false,
    });

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            let parsed;

            try {
                parsed = JSON.parse(message.value.toString());
            } catch (err) {
                console.error('[Kafka] Failed to parse message:', message.value?.toString());
                return; // skip unparseable messages — don't crash the consumer
            }

            const { eventType, ...payload } = parsed;
            const handler = handlers[eventType];

            if (!handler) {
                console.warn(`[Kafka] No handler for event: ${eventType}`);
                return;
            }

            try {
                await handler(payload);
            } catch (err) {
                // Log with enough context to replay manually if needed
                console.error(
                    `[Kafka] Handler failed for ${eventType} (topic=${topic}, partition=${partition}, offset=${message.offset}):`,
                    err.message
                );
                // Re-throw so kafkajs can apply its retry / pause-on-failure strategy
                throw err;
            }
        },
    });
};

const stopConsumer = async () => {
    await consumer.disconnect();
    console.log('[Kafka] Consumer disconnected');
};

module.exports = { startConsumer, stopConsumer };