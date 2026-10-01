const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, resetDb, agent, settle } = require('./helpers/server.js');

let Idea, Comment, BaseUser;

before(async () => {
	await start();
	({ Idea }     = require('../src/models/ideas.model.js'));
	({ Comment }  = require('../src/models/comments.model.js'));
	({ BaseUser } = require('../src/models/user.model.js'));
});
after(stop);
beforeEach(resetDb);

const newUser = async (role, name) => {
	const a = agent();
	const email = `${name.toLowerCase()}@example.test`;
	const res = await a.post('/auth/signup', { name, email, password: 'long enough pw', role, accepted_terms: true });
	assert.equal(res.status, 201, JSON.stringify(res.body));
	a.id = res.body.user._id;
	return a;
};

const newIdea = async (founder, extra = {}) => {
	const res = await founder.post('/ideas', { title: 'Edge Vision', description: 'Cheap vision kits for farms', stage: 'concept', ...extra });
	assert.equal(res.status, 201, JSON.stringify(res.body));
	return res.body._id;
};

test('health reports each dependency', async () => {
	const a = agent();
	const h = await a.get('/health');
	assert.equal(h.status, 200);
	assert.equal(h.body.mongo, 'up');
	assert.equal(h.body.redis, 'down');

});

test('malformed JSON gets a 400 JSON error, not an HTML stack trace', async () => {
	const base = (await agent().get('/health')) && require('./helpers/server.js').baseUrl();
	const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad json' });
	const text = await res.text();
	assert.equal(res.status, 400);
	assert.equal(JSON.parse(text).success, false);
	assert.ok(!/at .*\.js:\d+/.test(text), 'no stack trace');
});

test('comments are saved in Mongo, readable, counted, and notify the idea owner (Kafka off, Redis off)', async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	const ideaId = await newIdea(fay);

	const posted = await ivan.post(`/ideas/${ideaId}/comments`, { text: '  Love the pilot plan  ' });
	assert.equal(posted.status, 201);
	assert.equal(posted.body.comment.text, 'Love the pilot plan');
	assert.equal(posted.body.comment.author, 'Ivan');

	const list = await agent().get(`/ideas/${ideaId}/comments`);
	assert.equal(list.status, 200);
	assert.equal(list.body.comments.length, 1);
	assert.equal(await Comment.countDocuments({ postID: ideaId }), 1);
	assert.equal((await Idea.findById(ideaId).lean()).comments, 1);

	await settle();
	const owner = await BaseUser.findById(fay.id).lean();
	assert.equal(owner.notifications.length, 1);
	assert.match(owner.notifications[0].text, /Ivan commented on “Edge Vision”/);

	// The owner commenting on their own idea doesn't notify themselves.
	await fay.post(`/ideas/${ideaId}/comments`, { text: 'Thanks!' });
	await settle();
	assert.equal((await BaseUser.findById(fay.id).lean()).notifications.length, 1);

	assert.equal((await ivan.post(`/ideas/${ideaId}/comments`, { text: '   ' })).status, 400);
	assert.equal((await ivan.post(`/ideas/${ideaId}/comments`, { text: 'x'.repeat(2001) })).status, 400);
	assert.equal((await ivan.post('/ideas/000000000000000000000000/comments', { text: 'hi' })).status, 404);
});

test('comment edit is author-only; delete by author or idea owner decrements once', async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	const cole = await newUser('founder', 'Cole');
	const ideaId = await newIdea(fay);
	const c = (await ivan.post(`/ideas/${ideaId}/comments`, { text: 'first' })).body.comment;

	assert.equal((await cole.put(`/ideas/comments/${c.id}`, { text: 'hijack' })).status, 403);
	assert.equal((await ivan.put(`/ideas/comments/${c.id}`, { text: 'edited' })).status, 200);
	assert.equal((await cole.del(`/ideas/comments/${c.id}`)).status, 403);
	assert.equal((await fay.del(`/ideas/comments/${c.id}`)).status, 200);
	assert.equal((await fay.del(`/ideas/comments/${c.id}`)).status, 404);
	assert.equal((await Idea.findById(ideaId).lean()).comments, 0);
});

test('likes: repeat like counts once, unlike once, bad ids are rejected (both /ideas and /feed)', async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	const ideaId = await newIdea(fay);

	const one = await ivan.post(`/ideas/${ideaId}/like`);
	const two = await ivan.post(`/feed/like/${ideaId}`);
	assert.equal(one.body.likes, 1);
	assert.equal(two.body.alreadyLiked, true);
	assert.equal(two.body.likes, 1);

	await Promise.all(Array.from({ length: 10 }, () => ivan.post(`/ideas/${ideaId}/like`)));
	assert.equal((await Idea.findById(ideaId).lean()).likes, 1, 'parallel likes still count once');

	assert.equal((await ivan.post(`/feed/unlike/${ideaId}`)).body.likes, 0);
	assert.equal((await ivan.del(`/ideas/${ideaId}/like`)).body.alreadyUnliked, true);
	assert.equal((await Idea.findById(ideaId).lean()).likes, 0);

	assert.equal((await ivan.post('/feed/like/not-an-id')).status, 400);
	assert.equal((await ivan.post('/ideas/000000000000000000000000/like')).status, 404);
});

test('a new idea shows up in "my ideas" immediately, and the feed rejects unknown genres', async () => {
	const fay = await newUser('founder', 'Fay');
	await newIdea(fay);
	const mine = await fay.get('/ideas/user');
	assert.equal(mine.status, 200);
	assert.equal(mine.body.length, 1);

	assert.equal((await agent().post('/feed', { genre: 'anything-random' })).status, 400);
	const feed = await agent().post('/feed', { genre: 'concept' });
	assert.equal(feed.status, 200);
	assert.equal(feed.body.posts.length, 1);
});

test('collaboration requests notify the owner once per requester', async () => {
	const fay = await newUser('founder', 'Fay');
	const cole = await newUser('founder', 'Cole');
	const ideaId = await newIdea(fay);
	await cole.post(`/ideas/${ideaId}/collaborate`);
	await cole.post(`/ideas/${ideaId}/collaborate`);
	await cole.post(`/ideas/${ideaId}/collaborate`);
	const { notifications } = await BaseUser.findById(fay.id).lean();
	assert.equal(notifications.length, 1);
	// C0: the owner sees who asked, never their email.
	assert.match(notifications[0].text, /^Cole asked to join “/);
	assert.doesNotMatch(notifications[0].text, /@/);
});

test('asking to join a draft answers like a missing idea', async () => {
	const fay = await newUser('founder', 'Fay');
	const cole = await newUser('founder', 'Cole');
	const draftId = await newIdea(fay, { title: 'Quiet draft', isDraft: true });
	const res = await cole.post(`/ideas/${draftId}/collaborate`);
	assert.equal(res.status, 404);
	assert.equal((await BaseUser.findById(fay.id).lean()).notifications.length, 0);
});
