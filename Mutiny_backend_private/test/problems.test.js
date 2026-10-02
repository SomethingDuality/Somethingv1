// Community C3: the problems board.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, resetDb, agent, verifyEmail, trustReporter, settle } = require('./helpers/server.js');

let Problem, Vote, Comment, Report, BaseUser;

before(async () => {
	await start();
	({ Problem }  = require('../src/models/problem.model.js'));
	({ Vote }     = require('../src/models/vote.model.js'));
	({ Comment }  = require('../src/models/comments.model.js'));
	({ Report }   = require('../src/models/report.model.js'));
	({ BaseUser } = require('../src/models/user.model.js'));
	await Vote.init();
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
const post = async (user, body) => {
	const res = await user.post('/problems', { text: 'Invoices take weeks to reconcile', tags: ['fintech'], ...body });
	assert.equal(res.status, 201, JSON.stringify(res.body));
	return res.body;
};

test('an anonymous problem names nobody, anywhere; a named one shows name and role only', async () => {
	const zed = await newUser('investor', 'Zedquill');
	const anon = await post(zed, { anonymous: true });
	const named = await post(zed, { text: 'Kirana credit is all on paper' });

	const fay = await newUser('founder', 'Fay');
	for (const body of [(await fay.get('/problems')).body, (await fay.get(`/problems/${anon.id}`)).body, (await agent().get('/problems')).body]) {
		const json = JSON.stringify(body);
		assert.doesNotMatch(json, new RegExp(zed.id)); // never an author id
		assert.doesNotMatch(json, /zedquill@/i);
	}
	const list = (await fay.get('/problems')).body.problems;
	assert.equal(list.find((p) => p.id === anon.id).author, null);
	assert.doesNotMatch(JSON.stringify(list.find((p) => p.id === anon.id)), /Zedquill/);
	assert.deepEqual(list.find((p) => p.id === named.id).author, { name: 'Zedquill', role: 'Investor' });
	assert.equal(list.find((p) => p.id === named.id).isMine, false);
	assert.equal((await zed.get(`/problems/${anon.id}`)).body.isMine, true);
});

test('posting: 280 characters, up to 3 known sectors, and the word filter', async () => {
	const fay = await newUser('founder', 'Fay');
	assert.equal((await fay.post('/problems', { text: 'x'.repeat(281) })).status, 400);
	assert.equal((await fay.post('/problems', { text: 'Ok', tags: ['fintech', 'health', 'climate', 'web3'] })).status, 400);
	const p = await post(fay, { tags: ['Fintech', 'not-a-sector'] });
	assert.deepEqual(p.tags, ['fintech']);
	assert.equal((await fay.post('/problems', { text: 'this fucking printer' })).body.code, 'BLOCKED_WORDS');
	const flagged = await post(fay, { text: 'Guaranteed returns schemes everywhere' });
	assert.equal((await Problem.findById(flagged.id).lean()).moderation.needsReview, true);
	assert.equal((await agent().post('/problems', { text: 'Hi' })).status, 401);
});

test('votes: one per person, switchable, never on your own post, and parallel-safe', async () => {
	const fay = await newUser('founder', 'Fay');
	const p = await post(fay);
	const ivan = await newUser('investor', 'Ivan');
	const vote = (u, value) => u.put(`/problems/${p.id}/vote`, { value });

	assert.equal((await vote(fay, 1)).status, 403);
	assert.deepEqual(pick((await vote(ivan, 1)).body), { upvotes: 1, downvotes: 0, score: 1, myVote: 1 });
	assert.deepEqual(pick((await vote(ivan, 1)).body), { upvotes: 1, downvotes: 0, score: 1, myVote: 1 });
	assert.deepEqual(pick((await vote(ivan, -1)).body), { upvotes: 0, downvotes: 1, score: -1, myVote: -1 });
	assert.deepEqual(pick((await vote(ivan, 0)).body), { upvotes: 0, downvotes: 0, score: 0, myVote: 0 });
	assert.equal((await vote(ivan, 2)).status, 400);

	await Promise.all(Array.from({ length: 10 }, () => vote(ivan, 1)));
	assert.equal(await Vote.countDocuments({}), 1);
	assert.equal((await Problem.findById(p.id).lean()).score, 1);

	const others = await Promise.all(Array.from({ length: 6 }, (_, i) => newUser('investor', `V${i}x`)));
	await Promise.all(others.map((u, i) => vote(u, i % 3 === 0 ? -1 : 1)));
	const doc = await Problem.findById(p.id).lean();
	assert.deepEqual([doc.upvotes, doc.downvotes, doc.score], [5, 2, 3]);
	const { recount } = require('../scripts/recount-votes.js');
	assert.deepEqual(await recount({ log: () => {} }), { fixed: 0 }, 'counters match the vote rows');
	assert.equal((await ivan.get('/problems')).body.problems[0].myVote, 1);
});

test('sorting, the week window, sector and text filters, and pages', async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	const old = await post(fay, { text: 'Old but loved', tags: ['health'] });
	// createdAt is immutable through Mongoose, so backdate it on the raw collection.
	const mongoose = require('mongoose');
	await Problem.collection.updateOne({ _id: new mongoose.Types.ObjectId(old.id) }, { $set: { createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000) } });
	const fresh = await post(fay, { text: 'Fresh one about payments' });
	await ivan.put(`/problems/${old.id}/vote`, { value: 1 });

	assert.equal((await ivan.get('/problems?sort=new')).body.problems[0].id, fresh.id);
	assert.equal((await ivan.get('/problems?sort=top&window=all')).body.problems[0].id, old.id);
	assert.deepEqual((await ivan.get('/problems?sort=top&window=week')).body.problems.map((p) => p.id), [fresh.id]);
	assert.deepEqual((await ivan.get('/problems?tag=health')).body.problems.map((p) => p.id), [old.id]);
	assert.deepEqual((await ivan.get('/problems?q=PAYMENTS')).body.problems.map((p) => p.id), [fresh.id]);
	assert.equal((await ivan.get('/problems?q=.*')).body.problems.length, 0); // not a regex

	for (let i = 0; i < 20; i++) await Problem.create({ authorId: fay.id, authorRole: 'Founder', text: `Bulk ${i}` });
	const first = (await ivan.get('/problems')).body;
	assert.equal(first.problems.length, 20);
	assert.equal(first.nextPage, 2);
	assert.equal((await ivan.get('/problems?page=2')).body.problems.length, 2);

	const trending = (await ivan.get('/problems/trending-tags')).body;
	assert.equal(trending[0].id, 'fintech');
});

test('replies: anonymous ones stay anonymous, the author is told, counts stay right', async () => {
	const fay = await newUser('founder', 'Fay');
	const p = await post(fay);
	const ivan = await newUser('investor', 'Ivan');
	const r = await ivan.post(`/problems/${p.id}/comments`, { text: 'We built a fix for this', anonymous: true });
	assert.equal(r.status, 201);
	assert.equal(r.body.author, null);
	await ivan.post(`/problems/${p.id}/comments`, { text: 'Happy to chat' });

	const replies = (await fay.get(`/problems/${p.id}/comments`)).body;
	assert.equal(replies.length, 2);
	assert.equal(replies[0].author, null);
	assert.equal(replies[1].author, 'Ivan');
	assert.doesNotMatch(JSON.stringify(replies), new RegExp(ivan.id));
	assert.equal((await Problem.findById(p.id).lean()).commentsCount, 2);

	await settle();
	const notes = (await BaseUser.findById(fay.id).lean()).notifications;
	assert.ok(notes.some((n) => n.text.startsWith('Someone replied to your problem') && n.link === `/founder/problems?p=${p.id}`));
	assert.ok(notes.some((n) => n.text.startsWith('Ivan replied to your problem')));

	// The problem's author may remove a reply; someone else may not.
	const cole = await newUser('founder', 'Cole');
	assert.equal((await cole.del(`/problems/comments/${r.body.id}`)).status, 403);
	assert.equal((await fay.del(`/problems/comments/${r.body.id}`)).status, 200);
	assert.equal((await Problem.findById(p.id).lean()).commentsCount, 1);
});

test('three reports hide a problem from everyone but its author; admins see where it lives', async () => {
	const fay = await newUser('founder', 'Fay');
	const p = await post(fay, { anonymous: true });
	for (const r of await Promise.all([0, 1, 2].map((i) => newUser('investor', `R${i}x`)))) {
		await trustReporter(r.email);
		await r.post('/reports', { type: 'problem', id: p.id, reason: 'spam' });
	}
	assert.equal((await agent().get('/problems')).body.problems.length, 0);
	const own = (await fay.get('/problems')).body.problems;
	assert.equal(own[0].hidden, 'hidden');

	const saved = process.env.ADMIN_EMAILS;
	process.env.ADMIN_EMAILS = fay.email;
	await verifyEmail(fay.email);
	try {
		const queue = (await fay.get('/admin/moderation?view=hidden')).body;
		assert.equal(queue[0].type, 'problem');
		assert.equal(queue[0].place.kind, 'problem');
		assert.equal(queue[0].anonymous, true);
		assert.equal(queue[0].author, 'Fay'); // admins see who wrote it
	} finally {
		if (saved === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = saved;
	}
});

test('deleting a problem, or the account, takes its votes, replies and reports with it', async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	const mine = await post(fay);
	const theirs = await post(ivan, { text: 'Hiring is slow' });
	await ivan.put(`/problems/${mine.id}/vote`, { value: 1 });
	await ivan.post(`/problems/${mine.id}/comments`, { text: 'Same here' });
	await ivan.post('/reports', { type: 'problem', id: mine.id, reason: 'other' });
	await fay.put(`/problems/${theirs.id}/vote`, { value: -1 });
	await fay.post(`/problems/${theirs.id}/comments`, { text: 'Try referrals' });

	assert.equal((await ivan.del(`/problems/${mine.id}`)).status, 403);
	assert.equal((await fay.del(`/problems/${mine.id}`)).status, 200);
	assert.equal(await Vote.countDocuments({ targetId: mine.id }), 0);
	assert.equal(await Comment.countDocuments({ postID: mine.id }), 0);
	assert.equal(await Report.countDocuments({}), 0);

	assert.equal((await fay.del('/auth/account', { confirmEmail: fay.email })).status, 200);
	const left = await Problem.findById(theirs.id).lean();
	assert.deepEqual([left.downvotes, left.score, left.commentsCount], [0, 0, 0]);
	assert.equal(await Vote.countDocuments({}), 0);
});

function pick(b) {
	return { upvotes: b.upvotes, downvotes: b.downvotes, score: b.score, myVote: b.myVote };
}
