const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { start, stop, resetDb, agent, baseUrl } = require('./helpers/server.js');

let Idea, Like, Comment, Team, Portfolio, BaseUser;

before(async () => {
	await start();
	({ Idea } = require('../src/models/ideas.model.js'));
	({ Like } = require('../src/models/likes.model.js'));
	({ Comment } = require('../src/models/comments.model.js'));
	({ Team } = require('../src/models/team.model.js'));
	({ Portfolio } = require('../src/models/portfolio.model.js'));
	({ BaseUser } = require('../src/models/user.model.js'));
});
after(stop);
beforeEach(resetDb);

const newUser = async (role, name) => {
	const a = agent();
	const email = `${name.toLowerCase()}@example.test`;
	const res = await a.post('/auth/signup', { name, email, password: 'long enough pw', role, accepted_terms: true });
	assert.equal(res.status, 201);
	a.id = res.body.user._id;
	a.email = email;
	return a;
};

// Multipart upload through the real route, with the agent's cookies.
const upload = async (a, ideaId) => {
	const form = new FormData();
	form.append('file', new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), 'deck.pdf');
	const cookie = [...a.jar].map(([k, v]) => `${k}=${v}`).join('; ');
	const res = await fetch(`${baseUrl()}/ideas/${ideaId}/attachments`, { method: 'POST', headers: { cookie }, body: form });
	assert.equal(res.status, 201, await res.text());
};

const uploadsDir = (ideaId) => path.join(__dirname, '../uploads/ideas', String(ideaId));

// An idea with a like, a comment, a $500 commitment, a team with a member, and a file.
const busyIdea = async (fay, ivan, mo) => {
	const idea = await fay.post('/ideas', { title: 'Campus compost', description: 'Composting for canteens.', isDraft: false });
	assert.equal(idea.status, 201, JSON.stringify(idea.body));
	const id = idea.body._id;
	assert.equal((await ivan.post(`/ideas/${id}/like`)).status, 200);
	assert.equal((await ivan.post(`/ideas/${id}/comments`, { text: 'Who pays per kilo?' })).status, 201);
	assert.equal((await ivan.post('/investor/commit', { ideaId: id, amount: 500 })).status, 201);
	const team = await fay.post('/teams', { idea_id: id, name: 'Compost crew' });
	assert.equal(team.status, 201, JSON.stringify(team.body));
	const teamId = team.body.team?._id ?? team.body._id;
	assert.equal((await fay.post(`/teams/${teamId}/members`, { user_id: mo.id, role: 'Engineer' })).status, 200);
	await upload(fay, id);
	assert.ok(fs.existsSync(uploadsDir(id)), 'the file is on disk before deletion');
	return id;
};

const assertGone = async (id, { ivan, mo, fay }) => {
	assert.equal(await Idea.countDocuments({ _id: id }), 0, 'idea');
	assert.equal(await Like.countDocuments({ postID: id }), 0, 'likes');
	assert.equal(await Comment.countDocuments({ postID: id }), 0, 'comments');
	assert.equal(await Team.countDocuments({ idea_id: id }), 0, 'team');
	assert.equal(fs.existsSync(uploadsDir(id)), false, 'attachment folder');
	assert.deepEqual((await BaseUser.findById(mo.id).lean()).teams, [], "the member's team list");
	if (fay) assert.deepEqual((await BaseUser.findById(fay.id).lean()).owned_teams, [], "the founder's owned teams");

	const portfolio = await Portfolio.findOne({ investor_id: ivan.id }).lean();
	assert.equal(portfolio.investments.length, 0, 'the commitment is cancelled');
	const notes = (await BaseUser.findById(ivan.id).lean()).notifications.map((n) => n.text);
	assert.ok(notes.some((t) => /deleted “Campus compost”\. Your \$500 commitment was cancelled; no money had moved\./.test(t)), notes.join(' | '));
};

test('deleting an idea deletes its likes, comments, team, files and commitments, and tells the investor', async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	const mo = await newUser('founder', 'Mo');
	const id = await busyIdea(fay, ivan, mo);

	const res = await fay.del(`/ideas/${id}`);
	assert.equal(res.status, 200, JSON.stringify(res.body));
	await assertGone(id, { fay, ivan, mo });

	const portfolio = await ivan.get('/investor/portfolio');
	assert.equal(portfolio.body.data.length, 0, "Investments no longer lists it");
	assert.equal(portfolio.body.totalCommitted, 0);
});

test("a founder deleting their account deletes their ideas the same way", async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	const mo = await newUser('founder', 'Mo');
	const id = await busyIdea(fay, ivan, mo);

	const res = await fay.del('/auth/account', { confirmEmail: fay.email });
	assert.equal(res.status, 200, JSON.stringify(res.body));
	await assertGone(id, { ivan, mo });
});

test("deleting an account takes that user's likes back off the counters (X-89)", async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	const idea = await fay.post('/ideas', { title: 'Campus compost', description: 'Composting for canteens.', isDraft: false });
	const id = idea.body._id;
	await ivan.post(`/ideas/${id}/like`);
	assert.equal((await Idea.findById(id).lean()).likes, 1);

	assert.equal((await ivan.del('/auth/account', { confirmEmail: ivan.email })).status, 200);
	assert.equal((await Idea.findById(id).lean()).likes, 0);
	assert.equal(await Like.countDocuments({ postID: id }), 0);
});
