// Boots the real Express app against an in-memory MongoDB (no Docker needed).
// Kafka is disabled, so events run in-process; Redis isn't connected, so caching is a no-op.
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

process.env.NODE_ENV             = 'test';
process.env.KAFKA_ENABLED        = 'false';
process.env.ACCESS_TOKEN_SECRET  = 'test_access_secret';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret';
process.env.RATE_LIMIT_MULTIPLIER = process.env.RATE_LIMIT_MULTIPLIER || '100';
process.env.APP_BASE_URL         = 'http://localhost:3000';
process.env.MAIL_TRANSPORT       = 'console';

let mongod, server, baseUrl;

const start = async () => {
	mongod = await MongoMemoryServer.create();
	await mongoose.connect(mongod.getUri('something_test'));
	const app = require('../../src/app.js');
	await new Promise((resolve) => { server = app.listen(0, resolve); });
	baseUrl = `http://127.0.0.1:${server.address().port}`;
	return baseUrl;
};

const stop = async () => {
	if (server) await new Promise((resolve) => server.close(resolve));
	await mongoose.disconnect();
	if (mongod) await mongod.stop();
};

const resetDb = async () => {
	const { collections } = mongoose.connection;
	await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
};

// A tiny cookie-keeping client: one per simulated browser.
const agent = () => {
	const jar = new Map();
	const call = async (method, path, body) => {
		const headers = { 'content-type': 'application/json' };
		if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
		const res = await fetch(baseUrl + path, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		for (const c of res.headers.getSetCookie()) {
			const [pair] = c.split(';');
			const i = pair.indexOf('=');
			const k = pair.slice(0, i), v = pair.slice(i + 1);
			if (v === '' || /Expires=Thu, 01 Jan 1970/i.test(c)) jar.delete(k); else jar.set(k, v);
		}
		const text = await res.text();
		let json = null;
		try { json = text ? JSON.parse(text) : null; } catch { json = text; }
		return { status: res.status, body: json, raw: text };
	};
	return {
		jar,
		get:  (p)    => call('GET', p),
		post: (p, b) => call('POST', p, b ?? {}),
		put:  (p, b) => call('PUT', p, b ?? {}),
		del:  (p, b) => call('DELETE', p, b),
	};
};

// Wait for in-process event handlers (setImmediate) to finish.
const settle = (ms = 50) => new Promise((r) => setTimeout(r, ms));

module.exports = { start, stop, resetDb, agent, settle, baseUrl: () => baseUrl };
