// Commitments and releases under pressure (X-10, X-45, X-95): one commitment per idea however
// the id is written or however many requests race, at least $1, trust that can't be farmed, and
// clean answers (never a 500) when two releases collide.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, resetDb, agent } = require('./helpers/server.js');

let Portfolio, Investor;
before(async () => {
	await start();
	({ Portfolio } = require('../src/models/portfolio.model.js'));
	({ Investor } = require('../src/models/user.model.js'));
});
after(stop);
beforeEach(resetDb);

const newUser = async (role, name) => {
	const a = agent();
	const res = await a.post('/auth/signup', { name, email: `${name.toLowerCase()}@example.test`, password: 'long enough pw', role, accepted_terms: true });
	assert.equal(res.status, 201);
	a.id = res.body.user._id;
	return a;
};

const newIdea = async (fay) => {
	const res = await fay.post('/ideas', { title: 'Campus compost', description: 'Composting for canteens.', isDraft: false });
	assert.equal(res.status, 201);
	return res.body._id;
};

const trustOf = async (id) => (await Investor.findById(id).select('trust trustBreakdown').lean());
const investmentsOf = async (id) => (await Portfolio.findOne({ investor_id: id }).lean())?.investments ?? [];

test('one commitment per idea: other letter cases and parallel requests get a 409', async () => {
	const fay = await newUser('Founder', 'Fay');
	const ivan = await newUser('Investor', 'Ivan');
	const id = await newIdea(fay);

	assert.equal((await ivan.post('/investor/commit', { ideaId: id, amount: 1000 })).status, 201);
	assert.equal((await ivan.post('/investor/commit', { ideaId: id.toUpperCase(), amount: 1000 })).status, 409);

	const other = await newIdea(fay);
	const raced = await Promise.all(Array.from({ length: 6 }, () => ivan.post('/investor/commit', { ideaId: other, amount: 500 })));
	assert.deepEqual(raced.map((r) => r.status).sort(), [201, 409, 409, 409, 409, 409]);
	assert.equal((await investmentsOf(ivan.id)).length, 2);
	assert.equal((await Portfolio.countDocuments({ investor_id: ivan.id })), 1, 'never a second portfolio');
	assert.equal((await trustOf(ivan.id)).trustBreakdown.history, 2);
});

test('amounts start at $1 and many small releases earn trust once', async () => {
	const fay = await newUser('Founder', 'Fay');
	const ivan = await newUser('Investor', 'Ivan');
	const id = await newIdea(fay);
	assert.equal((await ivan.post('/investor/commit', { ideaId: id, amount: 0.5 })).status, 400);
	const c = await ivan.post('/investor/commit', { ideaId: id, amount: 100 });
	assert.equal(c.status, 201);
	const inv = c.body.investment._id;

	assert.equal((await ivan.post(`/investor/portfolio/${inv}/release`, { amount: 0.0001 })).status, 400);
	for (let i = 0; i < 5; i += 1) {
		assert.equal((await ivan.post(`/investor/portfolio/${inv}/release`, { amount: 1 })).status, 200);
	}
	const t = await trustOf(ivan.id);
	assert.equal(t.trustBreakdown.escrowReleases, 1, 'five releases on one commitment count once');
	assert.equal(t.trust, 1 * 1 + 1 * 5);
});

test('two releases at once: one goes through, the other is a 409, never a 500 or an over-release', async () => {
	const fay = await newUser('Founder', 'Fay');
	const ivan = await newUser('Investor', 'Ivan');
	const id = await newIdea(fay);
	const inv = (await ivan.post('/investor/commit', { ideaId: id, amount: 100 })).body.investment._id;

	const raced = await Promise.all(Array.from({ length: 5 }, () => ivan.post(`/investor/portfolio/${inv}/release`, { amount: 60 })));
	const codes = raced.map((r) => r.status);
	assert.ok(!codes.includes(500), `no 500s: ${codes}`);
	assert.equal(codes.filter((c) => c === 200).length, 1, `exactly one release: ${codes}`);
	const [row] = await investmentsOf(ivan.id);
	assert.equal(row.amount_released, 60);
});

test('withdrawing: only before money moved, the founder is told, and the trust point comes off', async () => {
	const fay = await newUser('Founder', 'Fay');
	const ivan = await newUser('Investor', 'Ivan');
	const id = await newIdea(fay);

	// commit → withdraw → commit can't farm trust any more.
	for (let i = 0; i < 3; i += 1) {
		const inv = (await ivan.post('/investor/commit', { ideaId: id, amount: 100 })).body.investment._id;
		assert.equal((await ivan.del(`/investor/portfolio/${inv}`)).status, 200);
	}
	assert.equal((await trustOf(ivan.id)).trustBreakdown.history, 0);
	assert.equal((await trustOf(ivan.id)).trust, 0);
	const notes = (await fay.get('/notifications')).body.map((n) => n.text);
	assert.ok(notes.includes('An investor withdrew their commitment to “Campus compost”'));

	const inv = (await ivan.post('/investor/commit', { ideaId: id, amount: 100 })).body.investment._id;
	assert.equal((await ivan.post(`/investor/portfolio/${inv}/release`, { amount: 10 })).status, 200);
	assert.equal((await ivan.del(`/investor/portfolio/${inv}`)).status, 409, 'released money stays on the record');
	assert.equal((await ivan.del('/investor/portfolio/not-an-id')).status, 400);
	assert.equal((await investmentsOf(ivan.id)).length, 1);
});


test('three ideas a day, even when posted all at once', async () => {
	const fay = await newUser('Founder', 'Fay');
	const posts = await Promise.all(Array.from({ length: 8 }, (_, i) =>
		fay.post('/ideas', { title: `Idea ${i}`, description: 'Composting for canteens.', isDraft: true })));
	assert.deepEqual(posts.map((r) => r.status).sort(), [201, 201, 201, 429, 429, 429, 429, 429]);
});
