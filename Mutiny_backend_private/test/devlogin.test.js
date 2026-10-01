const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, resetDb, agent } = require('./helpers/server.js');
const { TEST_ACCOUNTS } = require('../src/dev/testAccounts.js');

before(start);
after(stop);
beforeEach(resetDb);

// Every test leaves the switches as it found them (the helper runs with NODE_ENV=test).
const saved = { NODE_ENV: process.env.NODE_ENV, DEV_LOGIN: process.env.DEV_LOGIN };
afterEach(() => {
	process.env.NODE_ENV = saved.NODE_ENV;
	if (saved.DEV_LOGIN === undefined) delete process.env.DEV_LOGIN; else process.env.DEV_LOGIN = saved.DEV_LOGIN;
});

const seedFounder = async () => {
	const { name, email } = TEST_ACCOUNTS.find((a) => a.role === 'Founder');
	const res = await agent().post('/auth/signup', { name, email, password: 'long enough pw', role: 'founder', accepted_terms: true });
	assert.equal(res.status, 201);
};

test('dev login is off by default', async () => {
	delete process.env.DEV_LOGIN;
	await seedFounder();
	const a = agent();
	assert.equal((await a.get('/auth/dev-login')).status, 404);
	assert.equal((await a.post('/auth/dev-login', { role: 'founder' })).status, 404);
	assert.equal(a.jar.size, 0, 'no session cookies');
});

test('dev login stays off in production even when DEV_LOGIN=true', async () => {
	await seedFounder();
	process.env.DEV_LOGIN = 'true';
	process.env.NODE_ENV = 'production';
	const a = agent();
	assert.equal((await a.get('/auth/dev-login')).status, 404);
	assert.equal((await a.post('/auth/dev-login', { role: 'founder' })).status, 404);
	assert.equal(a.jar.size, 0);
});

test('when on, one click signs in as the seeded test account', async () => {
	process.env.DEV_LOGIN = 'true';
	await seedFounder();
	const a = agent();

	const status = await a.get('/auth/dev-login');
	assert.equal(status.status, 200);
	assert.deepEqual(status.body.accounts.map((x) => x.role), ['founder'], 'lists only accounts that exist');

	const res = await a.post('/auth/dev-login', { role: 'founder' });
	assert.equal(res.status, 200, JSON.stringify(res.body));
	assert.ok(a.jar.has('accessToken') && a.jar.has('refreshToken'));
	const me = await a.get('/auth/me');
	assert.equal(me.status, 200);
	assert.equal(me.body.email, 'founder@something.test');
	assert.equal(me.body.role, 'Founder');
});

test('dev login rejects a bad role and says how to create a missing account', async () => {
	process.env.DEV_LOGIN = 'true';
	const a = agent();
	assert.equal((await a.post('/auth/dev-login', { role: 'admin' })).status, 400);
	const missing = await a.post('/auth/dev-login', { role: 'investor' });
	assert.equal(missing.status, 404);
	assert.match(missing.body.message, /npm run dev:memory/);
	assert.equal(a.jar.size, 0);
});
