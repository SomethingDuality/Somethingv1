// Community C4: leaderboards (this week and all time), counts only.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { start, stop, resetDb, agent } = require('./helpers/server.js');

let Idea, Like, Vote, Problem;

before(async () => {
	await start();
	({ Idea }    = require('../src/models/ideas.model.js'));
	({ Like }    = require('../src/models/likes.model.js'));
	({ Vote }    = require('../src/models/vote.model.js'));
	({ Problem } = require('../src/models/problem.model.js'));
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
const newIdea = async (founder, title, tags = []) => {
	const res = await founder.post('/ideas', { title, description: `${title} in a sentence`, tags });
	assert.equal(res.status, 201, JSON.stringify(res.body));
	return res.body._id;
};
const oid = (id) => new mongoose.Types.ObjectId(id);
const lastMonth = () => new Date(Date.now() - 30 * 24 * 3600 * 1000);
const titles = (rows) => rows.map((r) => r.title);

test('ideas: this week counts recent supports, all time counts every support, and hidden ones never show', async () => {
	const fay = await newUser('founder', 'Fay');
	const a = await newIdea(fay, 'Alpha', ['fintech']);
	const b = await newIdea(fay, 'Beta', ['health']);
	const c = await newIdea(fay, 'Gamma', ['fintech']);
	const fans = await Promise.all([0, 1, 2, 3].map((i) => newUser('investor', `F${i}x`)));
	await fans[0].post(`/ideas/${a}/like`);
	await fans[1].post(`/ideas/${a}/like`);
	await fans[2].post(`/ideas/${b}/like`);
	// Gamma's three supports are a month old: all time only.
	for (const f of fans.slice(0, 3)) await f.post(`/ideas/${c}/like`);
	await Like.collection.updateMany({ postID: oid(c) }, { $set: { createdAt: lastMonth() } });

	const anon = agent();
	assert.deepEqual(titles((await anon.get('/leaderboards/ideas?window=week')).body), ['Alpha', 'Beta']);
	assert.deepEqual(titles((await anon.get('/leaderboards/ideas?window=all')).body), ['Gamma', 'Alpha', 'Beta']);
	assert.deepEqual((await anon.get('/leaderboards/ideas?window=week')).body.map((r) => r.count), [2, 1]);
	assert.deepEqual(titles((await anon.get('/leaderboards/ideas?window=all&sectors=fintech')).body), ['Gamma', 'Alpha']);

	await Idea.updateOne({ _id: a }, { $set: { 'moderation.state': 'hidden' } });
	await Idea.updateOne({ _id: c }, { $set: { isDraft: true } });
	assert.deepEqual(titles((await anon.get('/leaderboards/ideas?window=week')).body), ['Beta']);
	assert.deepEqual(titles((await anon.get('/leaderboards/ideas?window=all')).body), ['Beta']);

	const json = JSON.stringify((await anon.get('/leaderboards/ideas?window=all')).body);
	for (const f of fans) assert.doesNotMatch(json, new RegExp(f.id)); // never who
});

test('problems: this week sums recent votes, all time uses the score', async () => {
	const fay = await newUser('founder', 'Fay');
	const post = async (text) => (await fay.post('/problems', { text })).body.id;
	const p1 = await post('First problem');
	const p2 = await post('Second problem');
	const p3 = await post('Old favourite');
	const voters = await Promise.all([0, 1, 2].map((i) => newUser('investor', `V${i}x`)));
	await voters[0].put(`/problems/${p1}/vote`, { value: 1 });
	await voters[1].put(`/problems/${p1}/vote`, { value: 1 });
	await voters[0].put(`/problems/${p2}/vote`, { value: -1 }); // net negative: never listed
	for (const v of voters) await v.put(`/problems/${p3}/vote`, { value: 1 });
	await Vote.collection.updateMany({ targetId: oid(p3) }, { $set: { createdAt: lastMonth() } });

	const week = (await agent().get('/leaderboards/problems?window=week')).body;
	assert.deepEqual(week.map((r) => [r.text, r.count]), [['First problem', 2]]);
	const all = (await agent().get('/leaderboards/problems?window=all')).body;
	assert.deepEqual(all.map((r) => [r.text, r.count]), [['Old favourite', 3], ['First problem', 2]]);

	await Problem.updateOne({ _id: p3 }, { $set: { 'moderation.state': 'removed' } });
	assert.deepEqual((await agent().get('/leaderboards/problems?window=all')).body.map((r) => r.text), ['First problem']);
	assert.ok(!('author' in week[0]) && !('authorId' in week[0]));
});

test('limits are clamped to 1–25, and unknown boards are 404', async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	for (let i = 0; i < 3; i++) {
		const id = await newIdea(fay, `Idea ${i}`);
		await ivan.post(`/ideas/${id}/like`);
	}
	assert.equal((await agent().get('/leaderboards/ideas?window=all&limit=1')).body.length, 1);
	assert.equal((await agent().get('/leaderboards/ideas?window=all&limit=-4')).body.length, 1);
	assert.equal((await agent().get('/leaderboards/ideas?window=all&limit=999')).body.length, 3);
	assert.equal((await agent().get('/leaderboards/people')).status, 404);
});
