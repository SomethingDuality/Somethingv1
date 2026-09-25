const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, resetDb, agent } = require('./helpers/server.js');

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
	assert.equal((await a.post('/auth/change-password', { currentPassword: 'wrong one!', newPassword: 'next password' })).status, 401);
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

		await signup(agent());
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
