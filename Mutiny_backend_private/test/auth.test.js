const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, resetDb, agent, verifyEmail } = require('./helpers/server.js');

let mailer, google, BaseUser;

before(async () => {
	await start();
	mailer   = require('../src/utils/mailer.js');
	google   = require('../src/auth/google.js');
	({ BaseUser } = require('../src/models/user.model.js'));
});
after(stop);
beforeEach(resetDb);

const signup = (a, extra = {}) => a.post('/auth/signup', {
	name: 'Fay Founder', email: 'fay@example.test', password: 'correct horse', role: 'founder', accepted_terms: true, ...extra,
});

test('signup needs only name, email, password, role, terms — and ignores plan and extras', async () => {
	const a = agent();
	const res = await signup(a, { plan: 'nothing_pro', expertise: [], firm: 'X' });
	assert.equal(res.status, 201);
	assert.equal(res.body.user.plan, 'free');

	const me = await a.get('/auth/me');
	assert.equal(me.status, 200);
	assert.equal(me.body.role, 'Founder');
	assert.equal(me.body.plan, 'free');
	assert.equal(me.body.hasPassword, true);
});

test('signup validation: short password, bad email, no terms, duplicate', async () => {
	assert.equal((await signup(agent(), { password: 'short' })).status, 400);
	assert.equal((await signup(agent(), { email: 'not-an-email' })).status, 400);
	assert.equal((await signup(agent(), { accepted_terms: false })).status, 400);
	assert.equal((await signup(agent(), { password: 'fay@example.test' })).status, 400);
	assert.equal((await signup(agent())).status, 201);
	assert.equal((await signup(agent())).status, 409);
});

test('forgot-password never returns a token and the emailed link is single-use', async () => {
	await signup(agent());
	let link = null;
	const original = mailer.sendPasswordReset;
	mailer.sendPasswordReset = async (_email, l) => { link = l; };
	try {
		const unknown = await agent().post('/auth/forgot-password', { email: 'nobody@example.test' });
		const known   = await agent().post('/auth/forgot-password', { email: 'fay@example.test' });
		assert.equal(unknown.status, 200);
		assert.equal(known.status, 200);
		assert.deepEqual(known.body, unknown.body, 'same answer whether or not the account exists');
		assert.ok(!('resetToken' in known.body));
		assert.ok(!known.raw.includes(new URL(link).searchParams.get('token')));
	} finally {
		mailer.sendPasswordReset = original;
	}

	const token = new URL(link).searchParams.get('token');
	const first = await agent().post('/auth/reset-password', { token, newPassword: 'a brand new pass' });
	assert.equal(first.status, 200);
	const second = await agent().post('/auth/reset-password', { token, newPassword: 'another new pass' });
	assert.equal(second.status, 400, 'link must not work twice');

	assert.equal((await agent().post('/auth/login', { email: 'fay@example.test', password: 'correct horse' })).status, 401);
	assert.equal((await agent().post('/auth/login', { email: 'fay@example.test', password: 'a brand new pass' })).status, 200);

	const stored = await BaseUser.findOne({ email: 'fay@example.test' }).select('+passwordResetTokenHash').lean();
	assert.equal(stored.passwordResetTokenHash, undefined);
});

test('change-password requires the current password', async () => {
	const a = agent();
	await signup(a);
	// 400, not 401: a 401 would make the app refresh the session and send it again.
	assert.equal((await a.post('/auth/change-password', { currentPassword: 'wrong one!', newPassword: 'next password' })).status, 400);
	const ok = await a.post('/auth/change-password', { currentPassword: 'correct horse', newPassword: 'next password' });
	assert.equal(ok.status, 200);
	assert.equal((await a.get('/auth/me')).status, 200, 'this session stays signed in');
	assert.equal((await agent().post('/auth/login', { email: 'fay@example.test', password: 'correct horse' })).status, 401);
	assert.equal((await agent().post('/auth/login', { email: 'fay@example.test', password: 'next password' })).status, 200);
});

test('Continue with Google: new person needs a role, existing email links, Google-only login message', async () => {
	const original = google.verify;
	google.verify = async () => ({ googleId: 'g-123', email: 'ivan@example.test', emailVerified: true, name: 'Ivan Investor', picture: null });
	try {
		const noRole = await agent().post('/auth/google', { credential: 'x' });
		assert.equal(noRole.status, 409);
		assert.equal(noRole.body.code, 'ROLE_REQUIRED');

		const a = agent();
		const created = await a.post('/auth/google', { credential: 'x', role: 'investor', accepted_terms: true });
		assert.equal(created.status, 201);
		assert.equal(created.body.user.plan, 'free');
		const me = await a.get('/auth/me');
		assert.equal(me.body.role, 'Investor');
		assert.equal(me.body.hasPassword, false);

		const again = await agent().post('/auth/google', { credential: 'x' });
		assert.equal(again.status, 200, 'returning Google user signs straight in');

		const pw = await agent().post('/auth/login', { email: 'ivan@example.test', password: 'whatever1' });
		assert.equal(pw.status, 401);
		assert.equal(pw.body.code, 'GOOGLE_ONLY');

		// A verified password account keeps its password when Google is linked.
		await signup(agent());
		await verifyEmail('fay@example.test');
		google.verify = async () => ({ googleId: 'g-fay', email: 'fay@example.test', emailVerified: true, name: 'Fay' });
		const linked = await agent().post('/auth/google', { credential: 'y' });
		assert.equal(linked.status, 200);
		const fay = await BaseUser.findOne({ email: 'fay@example.test' }).lean();
		assert.equal(fay.googleId, 'g-fay');
		assert.deepEqual(fay.authProviders.sort(), ['google', 'password']);

		google.verify = async () => ({ googleId: 'g-x', email: 'x@example.test', emailVerified: false });
		assert.equal((await agent().post('/auth/google', { credential: 'z', role: 'founder', accepted_terms: true })).status, 401);
	} finally {
		google.verify = original;
	}
});

test('deleting an account requires typing the email', async () => {
	const a = agent();
	await signup(a);
	assert.equal((await a.del('/auth/account', {})).status, 400);
	assert.equal((await a.del('/auth/account', { confirmEmail: 'FAY@example.test' })).status, 200);
	assert.equal(await BaseUser.countDocuments({}), 0);
});


test('an unverified password account is taken back by the email owner on Google sign-in', async () => {
	const google = require('../src/auth/google.js');
	const original = google.verify;
	// Someone signs up with Vic's address first (they never verify it: they can't).
	const squatter = agent();
	assert.equal((await squatter.post('/auth/signup', { name: 'Not Vic', email: 'vic@example.test', password: 'squatter pass 1', role: 'founder', accepted_terms: true })).status, 201);
	google.verify = async () => ({ googleId: 'g-vic', email: 'vic@example.test', emailVerified: true, name: 'Vic' });
	try {
		assert.equal((await agent().post('/auth/google', { credential: 'v' })).status, 200);
		const vic = await BaseUser.findOne({ email: 'vic@example.test' }).lean();
		assert.equal(vic.password, undefined, "the squatter's password is gone");
		assert.equal(vic.emailVerified, true);
		assert.deepEqual(vic.authProviders, ['google']);
		assert.equal((await agent().post('/auth/login', { email: 'vic@example.test', password: 'squatter pass 1' })).status, 401);
		assert.equal((await squatter.post('/auth/refresh')).status, 401, "the squatter's session ended");
	} finally {
		google.verify = original;
	}
});

test('the emailed link verifies the address, and only a verified admin address is an admin', async () => {
	const logs = [];
	const log = console.log;
	console.log = (...args) => { logs.push(args.join(' ')); };
	const a = agent();
	try {
		assert.equal((await a.post('/auth/signup', { name: 'Ada', email: 'ada@example.test', password: 'long enough pw', role: 'founder', accepted_terms: true })).status, 201);
	} finally {
		console.log = log;
	}
	const link = logs.find((l) => l.includes('Verify the email for ada@example.test'));
	assert.ok(link, 'a verification link was sent');
	const token = decodeURIComponent(link.split('token=')[1]);

	const saved = process.env.ADMIN_EMAILS;
	process.env.ADMIN_EMAILS = 'ada@example.test';
	try {
		assert.equal((await a.get('/auth/me')).body.isAdmin, false, 'the address alone is not enough');
		assert.equal((await a.get('/admin/moderation')).status, 404);
		assert.equal((await a.post('/auth/verify-email', { token: 'nope' })).status, 400);
		assert.equal((await agent().post('/auth/verify-email', { token })).status, 200);
		assert.equal((await agent().post('/auth/verify-email', { token })).status, 400, 'single use');
		const me = (await a.get('/auth/me')).body;
		assert.equal(me.emailVerified, true);
		assert.equal(me.isAdmin, true);
		assert.equal((await a.get('/admin/moderation')).status, 200);
	} finally {
		if (saved === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = saved;
	}
});

test('each device has its own session: a second sign-in or two tabs refreshing never sign anyone out', async () => {
	await signup(agent());
	const laptop = agent();
	const phone = agent();
	assert.equal((await laptop.post('/auth/login', { email: 'fay@example.test', password: 'correct horse' })).status, 200);
	assert.equal((await phone.post('/auth/login', { email: 'fay@example.test', password: 'correct horse' })).status, 200);
	assert.equal((await laptop.post('/auth/refresh')).status, 200, 'the phone signing in kept the laptop in');
	assert.equal((await phone.post('/auth/refresh')).status, 200);

	// Two tabs on the laptop refresh with the same cookie at once.
	const both = await Promise.all([laptop.post('/auth/refresh'), laptop.post('/auth/refresh')]);
	assert.deepEqual(both.map((r) => r.status), [200, 200]);
	assert.equal((await laptop.get('/auth/me')).status, 200);
	assert.equal((await laptop.post('/auth/refresh')).status, 200, 'and the laptop can keep refreshing');

	// An old token replayed later ends that device's session only.
	const stale = laptop.jar.get('refreshToken');
	assert.equal((await laptop.post('/auth/refresh')).status, 200);
	await new Promise((r) => setTimeout(r, 10));
	const thief = agent();
	thief.jar.set('refreshToken', stale);
	const { BaseUser: U } = require('../src/models/user.model.js');
	await U.updateOne({ email: 'fay@example.test' }, { $set: { 'sessions.$[].rotatedAt': new Date(Date.now() - 60 * 1000) } });
	assert.equal((await thief.post('/auth/refresh')).status, 401);
	assert.equal((await laptop.post('/auth/refresh')).status, 401, "the laptop's session ended with it");
	assert.equal((await phone.post('/auth/refresh')).status, 200, 'the phone is untouched');

	// Logging out ends one device.
	assert.equal((await phone.post('/auth/logout')).status, 200);
	assert.equal((await phone.post('/auth/refresh')).status, 401);
});
