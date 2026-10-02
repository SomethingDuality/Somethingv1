// The F3 bug hunt (2026-10-02): regressions for what it found in the Node backend.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, resetDb, agent, internal, verifyEmail, fakeAgent } = require('./helpers/server.js');

let Idea;
before(async () => {
	await start();
	({ Idea } = require('../src/models/ideas.model.js'));
});
after(stop);
beforeEach(resetDb);

const newUser = async (role, name) => {
	const a = agent();
	a.email = `${name.toLowerCase()}@example.test`;
	const res = await a.post('/auth/signup', { name, email: a.email, password: 'long enough pw', role, accepted_terms: true });
	assert.equal(res.status, 201, JSON.stringify(res.body));
	a.id = res.body.user._id;
	return a;
};
const newIdea = async (fay, extra = {}) => {
	const res = await fay.post('/ideas', { title: 'Campus compost', description: 'Composting for canteens.', isDraft: false, ...extra });
	assert.equal(res.status, 201, JSON.stringify(res.body));
	return res.body._id;
};

test('profile and agent writes go through the word filter; prototype keys are just unknown fields', async () => {
	const fay = await newUser('founder', 'Fay');
	const id = await newIdea(fay);
	assert.equal((await fay.put('/founder/profile', { headline: 'f.u.ck this' })).status, 422);
	assert.equal((await fay.put('/founder/profile', { headline: 'Building compost for canteens' })).status, 200);
	const renamed = await internal('POST', '/internal/apply-update', { userId: fay.id, entity: 'idea', entityId: id, patch: { title: 'fuсk you' } });
	assert.equal(renamed.status, 422, 'the agent renaming an idea is filtered too');
	const proto = await internal('POST', '/internal/apply-update', { userId: fay.id, entity: 'user', patch: { constructor: 'x' } });
	assert.equal(proto.status, 422, 'not a 500');
});

test('the agent may write only the fields its memory mirrors', async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	const id = await newIdea(fay);
	assert.equal((await internal('POST', '/internal/apply-update', { userId: fay.id, entity: 'idea', entityId: id, patch: { isDraft: true } })).status, 422);
	assert.equal((await internal('POST', '/internal/apply-update', { userId: ivan.id, entity: 'user', patch: { ghostMode: false } })).status, 422);
	assert.equal((await internal('POST', '/internal/apply-update', { userId: fay.id, entity: 'idea', entityId: id, patch: { stage: 'mvp' } })).status, 200);
	assert.equal((await Idea.findById(id).lean()).isDraft, false);
});

test('deal flow drops ideas that left the public view since the batch was made', async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	const live = await newIdea(fay);
	const gone = await newIdea(fay, { title: 'Second idea' });
	assert.equal((await fay.put(`/ideas/${gone}`, { isDraft: true })).status, 200);
	fakeAgent().routes.set('GET /internal/deal-flow', (req, res, { json }) => json(200, {
		batch: { id: 'b1', size: 2 }, need: null, matcher: 'interim',
		matches: [{ id: 'm1', ideaId: live, reasons: [] }, { id: 'm2', ideaId: gone, reasons: [] }],
	}));
	const view = await ivan.get('/agent/deal-flow');
	assert.equal(view.status, 200);
	assert.deepEqual(view.body.matches.map((m) => m.ideaId), [live]);
});

test("the chat never sends someone else's idea to the agent", async () => {
	const fay = await newUser('founder', 'Fay');
	const mo = await newUser('founder', 'Mo');
	const theirs = await newIdea(mo);
	const res = await fay.post('/agent/chat', { text: 'Our pricing is 500 rupees a month', ideaId: theirs });
	assert.equal(res.status, 404);
	assert.equal(fakeAgent().requests.filter((r) => r.path === '/internal/chat').length, 0);
	assert.equal((await fay.post('/agent/chat', { text: 'hi', ideaId: [theirs] })).status, 400, 'arrays are not ids');
});

test('a verified admin can open a hidden idea from the queue; nobody else can', async () => {
	const fay = await newUser('founder', 'Fay');
	const cole = await newUser('founder', 'Cole');
	const ivan = await newUser('investor', 'Ivan');
	const id = await newIdea(cole);
	await Idea.updateOne({ _id: id }, { $set: { 'moderation.state': 'hidden' } });
	assert.equal((await ivan.get(`/ideas/${id}`)).status, 404);
	const saved = process.env.ADMIN_EMAILS;
	process.env.ADMIN_EMAILS = fay.email;
	try {
		assert.equal((await fay.get(`/ideas/${id}`)).status, 404, 'an unverified address is not an admin');
		await verifyEmail(fay.email);
		assert.equal((await fay.get(`/ideas/${id}`)).status, 200);
	} finally {
		if (saved === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = saved;
	}
});

test('a commitment that saved is a success even if the follow-ups fail', async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	const id = await newIdea(fay);
	const chat = require('../src/chat/chat.service.js');
	const original = chat.revealOnCommit;
	chat.revealOnCommit = async () => { throw new Error('chat down'); };
	try {
		assert.equal((await ivan.post('/investor/commit', { ideaId: id, amount: 500 })).status, 201);
	} finally {
		chat.revealOnCommit = original;
	}
	assert.equal((await ivan.post('/investor/commit', { ideaId: id, amount: 500 })).status, 409);
});
