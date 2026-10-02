const client = require('../config/redis.js');

// Cache-aside helpers. Every call is a no-op when Redis is not ready, so a Redis
// outage degrades to "always read from Mongo" instead of failing the request.

const getJSON = async (key) => {
	if (!client.isReady) return null;
	try {
		const raw = await client.get(key);
		return raw ? JSON.parse(raw) : null;
	} catch (err) {
		console.error(`[Cache] get ${key}:`, err.message);
		return null;
	}
};

const setJSON = async (key, value, ttlSeconds) => {
	if (!client.isReady) return;
	try {
		await client.setEx(key, ttlSeconds, JSON.stringify(value));
	} catch (err) {
		console.error(`[Cache] set ${key}:`, err.message);
	}
};

const del = async (...keys) => {
	if (!client.isReady || keys.length === 0) return;
	try {
		await client.del(keys);
	} catch (err) {
		console.error(`[Cache] del ${keys.join(',')}:`, err.message);
	}
};

// Deletes every key matching a pattern (SCAN, never KEYS). For small cached families like
// popular_posts:v1:* that must drop at once when an idea leaves the public view.
const delPattern = async (pattern) => {
	if (!client.isReady) return;
	try {
		for await (const batch of client.scanIterator({ MATCH: pattern, COUNT: 200 })) {
			const keys = Array.isArray(batch) ? batch : [batch];
			if (keys.length) await client.del(keys);
		}
	} catch (err) {
		console.error(`[Cache] delPattern ${pattern}:`, err.message);
	}
};

// An idea joined or left the public view: the lists that show public ideas drop at once (X-92).
const dropPublicLists = () => Promise.all([delPattern('popular_posts:v1:*'), delPattern('leaderboard:v1:*')]);

module.exports = { getJSON, setJSON, del, delPattern, dropPublicLists };
