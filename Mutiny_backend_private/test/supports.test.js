// Community C2: idea supports (upvote only), milestone notifications, supportedByMe, clean-up.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { start, stop, resetDb, agent, settle } = require('./helpers/server.js');

let Idea, Like, BaseUser, Comment;

before(async () => {
	await start();
	({ Idea }     = require('../src/models/ideas.model.js'));
	({ Like }     = require('../src/models/likes.model.js'));
	({ BaseUser } = require('../src/models/user.model.js'));
	({ Comment }  = require('../src/models/comments.model.js'));
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
const newIdea = async (founder, extra = {}) => {
	const res = await founder.post('/ideas', { title: 'Edge Vision', description: 'Cheap vision kits for farms', ...extra });
	assert.equal(res.status, 201, JSON.stringify(res.body));
	return res.body._id;
};
// Notifications come from events handled after the response, so let them land first.
const supportNotes = async (user) => {
	await settle();
	return ((await BaseUser.findById(user.id).lean()).notifications || []).filter((n) => /support/.test(n.text));
};

test("founders can't support their own idea", async () => {
	const fay = await newUser('founder', 'Fay');
	const ideaId = await newIdea(fay);
	const own = await fay.post(`/ideas/${ideaId}/like`);
	assert.equal(own.status, 403);
	assert.equal(own.body.code, 'OWN_IDEA');
	assert.equal((await fay.post(`/feed/like/${ideaId}`)).status, 403);
	assert.equal((await Idea.findById(ideaId).lean()).likes, 0);
});

test('the founder hears about the 1st and 10th supporter, never each one', async () => {
	const fay = await newUser('founder', 'Fay');
	const ideaId = await newIdea(fay, { title: 'Campus compost' });
	const backers = await Promise.all(Array.from({ length: 10 }, (_, i) => newUser('investor', `B${i}x`)));

	const first = await backers[0].post(`/ideas/${ideaId}/like`);
	assert.equal(first.status, 200);
	assert.equal(first.body.supportedByMe, true);
	let notes = await supportNotes(fay);
	assert.equal(notes.length, 1);
	assert.match(notes[0].text, /Someone supports “Campus compost”/);
	assert.equal(notes[0].link, `/founder/ideas/${ideaId}`);
	assert.doesNotMatch(notes[0].text, /B0x/); // never who

	// Taking it back and supporting again doesn't announce the first supporter twice.
	assert.equal((await backers[0].del(`/ideas/${ideaId}/like`)).body.supportedByMe, false);
	await backers[0].post(`/ideas/${ideaId}/like`);
	for (const b of backers.slice(1)) await b.post(`/ideas/${ideaId}/like`);

	notes = await supportNotes(fay);
	assert.equal(notes.length, 2);
	assert.ok(notes.some((n) => /^10 people now support “Campus compost”/.test(n.text)));
	assert.equal((await Idea.findById(ideaId).lean()).likes, 10);
});

test('supportedByMe tells a signed-in viewer what they support; anonymous gets nothing', async () => {
	const fay = await newUser('founder', 'Fay');
	const a = await newIdea(fay, { title: 'A' });
	const b = await newIdea(fay, { title: 'B' });
	const ivan = await newUser('investor', 'Ivan');
	await ivan.post(`/ideas/${a}/like`);

	const list = (await ivan.get('/ideas/discover')).body;
	assert.equal(list.find((i) => i._id === a).supportedByMe, true);
	assert.equal(list.find((i) => i._id === b).supportedByMe, false);
	assert.equal((await ivan.get(`/ideas/${a}`)).body.supportedByMe, true);
	assert.equal((await ivan.get(`/ideas/${b}`)).body.supportedByMe, false);

	const anon = (await agent().get('/ideas/discover')).body;
	assert.ok(anon.every((i) => !('supportedByMe' in i)));
});

test('the community clean-up deletes self-supports and recounts supports and comments', async () => {
	const fay = await newUser('founder', 'Fay');
	const ideaId = await newIdea(fay);
	const ivan = await newUser('investor', 'Ivan');
	await ivan.post(`/ideas/${ideaId}/like`);
	await ivan.post(`/ideas/${ideaId}/comments`, { text: 'Nice' });
	// The old app let founders like their own ideas, and counters drifted.
	await Like.create({ postID: ideaId, userId: fay.id });
	await Comment.create({ postID: ideaId, userId: ivan.id, text: 'gone', moderation: { state: 'removed' } });
	await Idea.updateOne({ _id: ideaId }, { $set: { likes: 7, comments: 5 } });

	const { migrate } = require('../scripts/migrate-community-v1.js');
	const dry = await migrate({ log: () => {} });
	assert.deepEqual(dry, { selfSupports: 1, likesFixed: 1, commentsFixed: 1 });
	assert.equal(await Like.countDocuments({}), 2, 'a dry run changes nothing');

	await migrate({ apply: true, log: () => {} });
	const idea = await Idea.findById(ideaId).lean();
	assert.equal(idea.likes, 1);
	assert.equal(idea.comments, 1);
	assert.equal(await Like.countDocuments({ userId: new mongoose.Types.ObjectId(fay.id) }), 0);
	assert.deepEqual(await migrate({ log: () => {} }), { selfSupports: 0, likesFixed: 0, commentsFixed: 0 });
});
