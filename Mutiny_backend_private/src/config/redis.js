const { createClient } = require('redis');

// Redis is a cache only. If it is down, callers fall back to Mongo (see utils/cache.js).
const client = createClient({
	url: process.env.REDIS_URL || 'redis://localhost:6379',
	// Fail fast instead of queueing commands while disconnected.
	disableOfflineQueue: true,
	socket: {
		connectTimeout: 5000,
		reconnectStrategy: (retries) => {
			if (retries > 10) {
				console.error('[Redis] Connection lost. Max retries reached');
				return new Error('Max retries reached');
			}
			const delay  = Math.min(Math.pow(2, retries) * 50, 2000);
			const jitter = Math.floor(Math.random() * 200);
			return delay + jitter;
		},
	},
});

// create a different client if we ever introduce financial transactions, and enable the offline queue :)
// add tls later once everything is verified and we get our own domain

// Log a connection problem once, not on every reconnect attempt.
let lastRedisError = null;
client.on('error', (err) => {
	const msg = err.code || err.message || String(err);
	if (msg !== lastRedisError) console.error('[Redis] unavailable:', msg);
	lastRedisError = msg;
});
client.on('ready', () => { lastRedisError = null; console.log('[Redis] ready'); });

// Non-fatal: the API keeps serving from Mongo when Redis is unavailable.
const connectRedis = async () => {
	try {
		await client.connect();
	} catch (err) {
		console.error('[Redis] connect failed, caching disabled:', err.message);
	}
};

const disconnectRedis = async () => {
	if (client.isOpen) await client.quit().catch(() => {});
};

module.exports = client;
module.exports.connectRedis    = connectRedis;
module.exports.disconnectRedis = disconnectRedis;
