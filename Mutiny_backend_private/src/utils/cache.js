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

module.exports = { getJSON, setJSON, del };
