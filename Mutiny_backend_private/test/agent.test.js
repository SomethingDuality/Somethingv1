// Browser-facing /agent routes: login required, the service key and user headers go to the agent,
// SSE passes through, and deletion purges everything the agent stored.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { start, stop, resetDb, agent, baseUrl, fakeAgent } = require('./helpers/server.js');
const { collections } = require('../src/shared/agent-collections.generated.json');

before(start);
after(stop);
beforeEach(async () => {
	await resetDb();
	await Promise.all(Object.keys(collections).map((n) => mongoose.connection.db.collection(n).deleteMany({})));
});

const newUser = async (role, name) => {
	const a = agent();
	const email = `${name.toLowerCase()}@example.test`;
	const res = await a.post('/auth/signup', { name, email, password: 'long enough pw', role, accepted_terms: true });
	assert.equal(res.status, 201);
	a.id = res.body.user._id;
	a.email = email;
	return a;
};

test('/agent needs a login, and passes the user to the agent with the service key', async () => {
	assert.equal((await agent().get('/agent/status')).status, 401);
	const fay = await newUser('founder', 'Fay');
	const res = await fay.get('/agent/status');
	assert.deepEqual(res.body, { live: true, fakeModels: true });
	const call = fakeAgent().requests.find((r) => r.path === '/internal/health');
	assert.equal(call.headers['x-agent-key'], 'test-node-to-agent');
	assert.equal(call.headers['x-agent-user-id'], fay.id);
	assert.equal(call.headers['x-agent-user-role'], 'Founder');
	assert.equal(call.headers.cookie, undefined, 'cookies never go to the agent');
});

test('agent down: status says so, calls fail with a clean JSON error', async () => {
	const fay = await newUser('founder', 'Fay');
	fakeAgent().down = true;
	assert.deepEqual((await fay.get('/agent/status')).body, { live: false });
	const res = await fay.post('/agent/diagnostics/echo', { message: 'hi' });
	assert.equal(res.status, 503);
	assert.equal(res.body.code, 'provider_unavailable');
	assert.ok(!JSON.stringify(res.body).includes('Error'), 'no traces');
});

test('SSE passes through with after= forwarded', async () => {
	const fay = await newUser('founder', 'Fay');
	const start = await fay.post('/agent/diagnostics/echo', { message: 'hi' });
	assert.equal(start.status, 200);
	const cookie = [...fay.jar].map(([k, v]) => `${k}=${v}`).join('; ');
	const res = await fetch(`${baseUrl()}/agent/diagnostics/echo/${start.body.runId}/stream?after=1`, { headers: { cookie } });
	assert.equal(res.status, 200);
	assert.match(res.headers.get('content-type'), /text\/event-stream/);
	const text = await res.text();
	assert.ok(!text.includes('id: 1\n'));
	assert.ok(text.includes('id: 2\nevent: echo'));
	assert.ok(text.includes('event: interrupt'));
	const call = fakeAgent().requests.find((r) => r.path.endsWith('/stream'));
	assert.equal(call.query.after, '1');
	assert.equal((await fetch(`${baseUrl()}/agent/diagnostics/echo/not-hex!/stream`, { headers: { cookie } })).status, 404);
});

const seedAgentRows = async (userId, ideaId) => {
	const db = mongoose.connection.db;
	const docs = { user_id: String(userId), idea_id: String(ideaId) };
	await Promise.all(Object.entries(collections).map(([name, keys]) => {
		if (keys.thread) return db.collection(name).insertMany([{ thread_id: `u:${userId}:i:${ideaId}:review:r1` }, { thread_id: `u:${userId}:t:review:r2` }]);
		return db.collection(name).insertOne(keys.idea ? { ...docs } : { user_id: String(userId) });
	}));
};

const count = async (filterFor) => {
	let n = 0;
	for (const [name, keys] of Object.entries(collections)) n += await mongoose.connection.db.collection(name).countDocuments(filterFor(keys));
	return n;
};

test('deleting an idea deletes what the agent stored about it, checkpoints included', async () => {
	const fay = await newUser('founder', 'Fay');
	const idea = (await fay.post('/ideas', { title: 'Gone soon', description: 'An idea.', isDraft: false })).body;
	await seedAgentRows(fay.id, idea._id);
	assert.equal((await fay.del(`/ideas/${idea._id}`)).status, 200);
	assert.equal(await count((k) => (k.idea ? { [k.idea]: String(idea._id) } : k.thread ? { [k.thread]: new RegExp(`:i:${idea._id}:`) } : { _never: 1 })), 0);
	assert.equal(await mongoose.connection.db.collection('agent_checkpoints').countDocuments({ thread_id: `u:${fay.id}:t:review:r2` }), 1, 'other threads stay');
	assert.deepEqual(fakeAgent().erased.at(-1), { ideaIds: [String(idea._id)] });
});

test('deleting an account deletes everything the agent stored about that user', async () => {
	const fay = await newUser('founder', 'Fay');
	const idea = (await fay.post('/ideas', { title: 'Mine', description: 'An idea.', isDraft: false })).body;
	await seedAgentRows(fay.id, idea._id);
	await mongoose.connection.db.collection('agent_notes').insertOne({ user_id: 'someone-else', text: 'keep' });
	assert.equal((await fay.del('/auth/account', { confirmEmail: fay.email })).status, 200);
	assert.equal(await count((k) => (k.user ? { [k.user]: fay.id } : { [k.thread]: new RegExp(`^u:${fay.id}:`) })), 0);
	assert.equal(await mongoose.connection.db.collection('agent_notes').countDocuments({ user_id: 'someone-else' }), 1);
	assert.ok(fakeAgent().erased.some((e) => e.userId === fay.id));
});

// ---- Reviews -----------------------------------------------------------------------------------

test('reviews are for founders: investors get 403 and the agent is never called', async () => {
	const ivan = await newUser('investor', 'Ivan');
	const before = fakeAgent().requests.length;
	assert.equal((await ivan.post('/agent/reviews', { text: 'An idea with enough words in it.' })).status, 403);
	assert.equal((await ivan.get('/agent/reviews/latest')).status, 403);
	assert.equal(fakeAgent().requests.length, before);
});

test('starting a review passes the body, the user and their timezone; errors pass through flat', async () => {
	const fay = await newUser('founder', 'Fay');
	fakeAgent().routes.set('POST /internal/reviews', (req, res, { body, json }) => json(200, { kind: 'review', reviewId: 'abcdef0123456789', quota: { used: 1, limit: 3 }, echo: body }));
	const res = await fetch(`${baseUrl()}/agent/reviews`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'x-user-tz': 'Asia/Kolkata', cookie: [...fay.jar].map(([k, v]) => `${k}=${v}`).join('; ') },
		body: JSON.stringify({ text: 'Composting for canteens, paid per kilo.', readers: ['nothing', 'bogus'] }),
	});
	const body = await res.json();
	assert.equal(res.status, 200);
	assert.deepEqual(body.echo, { text: 'Composting for canteens, paid per kilo.', readers: ['nothing'] });
	const call = fakeAgent().requests.find((r) => r.path === '/internal/reviews');
	assert.equal(call.headers['x-agent-user-tz'], 'Asia/Kolkata');

	fakeAgent().routes.set('POST /internal/reviews', (req, res, { json }) => json(429, { code: 'quota_exceeded', message: "You've used today's reviews.", retryable: false }));
	const over = await fay.post('/agent/reviews', { text: 'Composting for canteens, paid per kilo.' });
	assert.equal(over.status, 429);
	assert.equal(over.body.code, 'quota_exceeded');

	assert.equal((await fay.post('/agent/reviews', {})).status, 400);
	assert.equal((await fay.post('/agent/reviews', { ideaId: 'nope' })).status, 400);
	assert.equal((await fay.post('/agent/reviews', { text: 'x', readers: [] })).status, 400);
});

test('reactions are validated before they reach the agent', async () => {
	const fay = await newUser('founder', 'Fay');
	fakeAgent().routes.set('POST /internal/reviews/abcdef0123456789/react', (req, res, { body, json }) => json(200, { ok: true, echo: body }));
	assert.equal((await fay.post('/agent/reviews/abcdef0123456789/react', { kind: 'nope' })).status, 400);
	assert.equal((await fay.post('/agent/reviews/abcdef0123456789/react', { kind: 'dispute', riskId: 'a1' })).status, 400);
	assert.equal((await fay.post('/agent/reviews/abcdef0123456789/react', { kind: 'accept', riskId: 'a9' })).status, 400);
	const ok = await fay.post('/agent/reviews/abcdef0123456789/react', { kind: 'dispute', riskId: 'a2', text: '12 canteens paid.' });
	assert.deepEqual(ok.body.echo, { kind: 'dispute', riskId: 'a2', text: '12 canteens paid.' });
});

test('the waitlist script is a dry run unless asked to send, and sends once', async () => {
	const { run } = require('../scripts/notify-review-waitlist.js');
	const { Founder } = require('../src/models/user.model.js');
	const fay = await newUser('founder', 'Fay');
	await fay.post('/founder/review-waitlist', {});
	const quiet = () => {};
	assert.deepEqual(await run({ log: quiet }), { waiting: 1, sent: 0 });
	assert.equal((await Founder.findById(fay.id).lean()).notifications.filter((n) => n.key === 'review-live').length, 0);
	assert.deepEqual(await run({ send: true, log: quiet }), { waiting: 1, sent: 1 });
	assert.deepEqual(await run({ send: true, log: quiet }), { waiting: 0, sent: 0 });
	const doc = await Founder.findById(fay.id).lean();
	assert.equal(doc.notifications.filter((n) => n.key === 'review-live').length, 1);
	assert.equal(doc.reviewWaitlist.joinedAt, null);
});

// ---- Matched deal flow ----------------------------------------------------------------------------

test('deal flow passes through for investors and founders; actions are validated; reach is founder-only', async () => {
	const ivan = await newUser('investor', 'Ivan');
	const fay = await newUser('founder', 'Fay');
	fakeAgent().routes.set('GET /internal/deal-flow', (req, res, { json }) => json(200, { matches: [{ id: 'abcdef0123456789', reasons: ['In your sectors: Climate.'] }], role: req.headers['x-agent-user-role'] }));
	fakeAgent().routes.set('POST /internal/deal-flow/abcdef0123456789', (req, res, { body, json }) => json(200, { ok: true, status: body.action }));
	const inv = await ivan.get('/agent/deal-flow');
	assert.equal(inv.status, 200);
	assert.equal(inv.body.role, 'Investor');
	assert.equal((await fay.get('/agent/deal-flow')).body.role, 'Founder');
	assert.equal((await ivan.post('/agent/deal-flow/abcdef0123456789', { action: 'saved' })).body.status, 'saved');
	assert.equal((await ivan.post('/agent/deal-flow/abcdef0123456789', { action: 'delete-everything' })).status, 400);
	assert.equal((await ivan.get('/agent/ideas/65f0000000000000000000aa/reach')).status, 403);
	fakeAgent().routes.set('GET /internal/deal-flow/reach/65f0000000000000000000aa', (req, res, { json }) => json(200, { investors: 3, founders: 1, days: 7 }));
	assert.deepEqual((await fay.get('/agent/ideas/65f0000000000000000000aa/reach')).body, { investors: 3, founders: 1, days: 7 });
});

test('the agent can read public idea packets and person packets, never drafts or emails', async () => {
	const { internal } = require('./helpers/server.js');
	const fay = await newUser('founder', 'Fay');
	await fay.put('/founder/profile', { skills: ['engineering'], location: 'Pune' });
	await fay.post('/ideas', { title: 'Public one', description: 'Composting for canteens.', isDraft: false, tags: ['climate'], lookingFor: ['backend'] });
	await fay.post('/ideas', { title: 'Secret draft', description: 'Not yet.', isDraft: true });
	const ideas = (await internal('GET', '/internal/match/ideas')).body.ideas;
	assert.deepEqual(ideas.map((i) => i.title), ['Public one']);
	assert.equal(ideas[0].founderLocation, 'Pune');
	const me = (await internal('GET', `/internal/match/user/${fay.id}`)).body;
	assert.deepEqual(me.skills, ['engineering']);
	assert.equal(me.ownIdeas.length, 2);
	assert.ok(!JSON.stringify(me).includes('example.test'));
	const ivan = await newUser('investor', 'Ivan');
	const inv = (await internal('GET', `/internal/match/user/${ivan.id}`)).body;
	assert.equal(inv.minCheck, null, 'the 5,000 default is not an answer');
	const ids = (await internal('GET', '/internal/match/users?role=Investor')).body.ids;
	assert.deepEqual(ids, [ivan.id]);
});

test('the Something chat is founder-only and validates before calling the agent', async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	fakeAgent().routes.set('POST /internal/chat', (req, res, { body, json }) => json(200, { kind: 'about_this', reply: 'Start with the test.', echo: body }));
	assert.equal((await ivan.post('/agent/chat', { text: 'How do I test this?' })).status, 403);
	assert.equal((await fay.post('/agent/chat', { text: '' })).status, 400);
	assert.equal((await fay.post('/agent/chat', { text: 'x', reviewId: 'nope' })).status, 400);
	const ok = await fay.post('/agent/chat', { text: 'How do I test this?', reviewId: 'abcdef0123456789abcdef0123456789' });
	assert.equal(ok.status, 200);
	assert.deepEqual(ok.body.echo, { text: 'How do I test this?', reviewId: 'abcdef0123456789abcdef0123456789' });
});
