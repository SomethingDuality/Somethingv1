// The internal API the Python agent calls (src/internal/app.js on 127.0.0.1:INTERNAL_PORT).
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, resetDb, agent, internal, baseUrl, settle, fakeAgent } = require('./helpers/server.js');

let Founder, Idea;

before(async () => {
	await start();
	({ Founder } = require('../src/models/user.model.js'));
	({ Idea } = require('../src/models/ideas.model.js'));
});
after(stop);
beforeEach(resetDb);

const newUser = async (role, name, extra = {}) => {
	const a = agent();
	const res = await a.post('/auth/signup', { name, email: `${name.toLowerCase()}@example.test`, password: 'long enough pw', role, accepted_terms: true, ...extra });
	assert.equal(res.status, 201);
	a.id = res.body.user._id;
	return a;
};

test('the internal API needs the agent key and is not on the public app', async () => {
	assert.equal((await internal('GET', '/internal/health', undefined, null)).status, 401);
	assert.equal((await internal('GET', '/internal/health', undefined, 'wrong')).status, 401);
	assert.equal((await internal('GET', '/internal/health')).status, 200);
	const pub = await fetch(`${baseUrl()}/internal/health`, { headers: { 'x-agent-key': 'test-agent-to-node' } });
	assert.equal(pub.status, 404, 'the public app must not serve /internal');
});

test('context for a review leaves out pedigree, names, email and secrets (R10)', async () => {
	const fay = await newUser('founder', 'Fay');
	await fay.put('/founder/profile', {
		location: 'Pune', skills: ['frontend'], about: 'Ex-Google, IIT Bombay', headline: 'Stanford dropout',
		education: [{ institution: 'IIT Bombay', degree: 'BTech' }], work_experience: [{ role: 'SWE', company: 'Google' }],
	});
	const idea = (await fay.post('/ideas', { title: 'Campus compost', description: 'Composting for canteens, paid per kilo.', isDraft: false })).body;
	const res = await internal('GET', `/internal/context/${fay.id}?ideaId=${idea._id}&purpose=review`);
	assert.equal(res.status, 200, JSON.stringify(res.body));
	const text = JSON.stringify(res.body);
	for (const leak of ['Google', 'IIT', 'Stanford', 'Fay', 'example.test', 'password']) assert.ok(!text.includes(leak), `leaked ${leak}`);
	assert.deepEqual(res.body.user.fields, { location: 'Pune', skills: ['frontend'], interests: [] });
	assert.equal(res.body.idea.fields.title, 'Campus compost');
	assert.equal(res.body.user.fieldSources, undefined);

	const mem = await internal('GET', `/internal/context/${fay.id}?ideaId=${idea._id}&purpose=memory`);
	assert.equal(mem.body.user.fields.about, 'Ex-Google, IIT Bombay', 'memory sees the founder\'s own profile');
	assert.equal(mem.body.user.fieldSources.location.source, 'profile');
	assert.ok(!JSON.stringify(mem.body).includes('example.test'), 'never the email');
});

test("context for someone else's idea is 404", async () => {
	const fay = await newUser('founder', 'Fay');
	const kai = await newUser('founder', 'Kai');
	const idea = (await fay.post('/ideas', { title: 'Mine', description: 'Mine only.', isDraft: false })).body;
	assert.equal((await internal('GET', `/internal/context/${kai.id}?ideaId=${idea._id}`)).status, 404);
	assert.equal((await internal('GET', '/internal/context/not-an-id')).status, 404);
});

test("apply-update writes through the registry with source 'agent', and the agent isn't told about its own write", async () => {
	const fay = await newUser('founder', 'Fay');
	const idea = (await fay.post('/ideas', { title: 'Old title', description: 'Something real.', isDraft: false })).body;
	await settle(100);
	fakeAgent().events.length = 0;

	const res = await internal('POST', '/internal/apply-update', { userId: fay.id, entity: 'idea', entityId: idea._id, patch: { stage: 'mvp' } });
	assert.equal(res.status, 200, JSON.stringify(res.body));
	const doc = await Idea.findById(idea._id).lean();
	assert.equal(doc.stage, 'mvp');
	assert.equal(doc.fieldSources.stage.source, 'agent');

	const u = await internal('POST', '/internal/apply-update', { userId: fay.id, patch: { location: 'Mumbai' } });
	assert.equal(u.status, 200);
	assert.equal((await Founder.findById(fay.id).lean()).fieldSources.location.source, 'agent');

	assert.equal((await internal('POST', '/internal/apply-update', { userId: fay.id, patch: { email: 'x@y.z' } })).status, 422);
	assert.equal((await internal('POST', '/internal/apply-update', { userId: fay.id, patch: { stage: 'nonsense' }, entity: 'idea', entityId: idea._id })).status, 422);

	await settle(100);
	assert.equal(fakeAgent().events.filter((e) => e.source === 'agent').length, 0, 'loop guard');
});

test('notify is idempotent by key', async () => {
	const fay = await newUser('founder', 'Fay');
	for (let i = 0; i < 2; i++) {
		assert.equal((await internal('POST', '/internal/notify', { userId: fay.id, text: 'Your review is ready.', key: 'review:1', link: '/founder/something' })).status, 200);
	}
	const notes = (await Founder.findById(fay.id).lean()).notifications.filter((n) => n.key === 'agent:review:1');
	assert.equal(notes.length, 1);
	assert.equal(notes[0].link, '/founder/something');
});

test('profile and idea events are forwarded to the agent', async () => {
	const fay = await newUser('founder', 'Fay');
	await fay.put('/founder/profile', { location: 'Pune' });
	await fay.post('/ideas', { title: 'Forward me', description: 'An idea.', isDraft: false });
	await settle(200);
	const types = fakeAgent().events.map((e) => e.eventType);
	assert.ok(types.includes('profile.updated'), types.join());
	assert.ok(types.includes('idea.created'), types.join());
	const ev = fakeAgent().events.find((e) => e.eventType === 'idea.created');
	assert.ok(ev.eventId && ev.ideaId && ev.founderId);
});
