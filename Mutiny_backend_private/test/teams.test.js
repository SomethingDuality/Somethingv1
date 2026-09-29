// Community C6: teams with invites, sent only from a co-founder chat.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { start, stop, resetDb, agent, settle } = require('./helpers/server.js');

let Team, TeamInvite, BaseUser;

before(async () => {
	await start();
	({ Team }       = require('../src/models/team.model.js'));
	({ TeamInvite } = require('../src/models/teamInvite.model.js'));
	({ BaseUser }   = require('../src/models/user.model.js'));
	await Team.init();
	await TeamInvite.init();
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
const newIdea = async (founder, title = 'Campus compost') => {
	const res = await founder.post('/ideas', { title, description: `${title}, in a sentence` });
	assert.equal(res.status, 201, JSON.stringify(res.body));
	return res.body._id;
};
// Cole asks to join Fay's idea; with `reply`, Fay answers so the chat is active.
const askToJoin = async (owner, member, ideaId, { reply = true } = {}) => {
	const t = (await member.post('/threads', { ideaId, text: 'Could I help with this?' })).body.thread;
	if (reply) await owner.post(`/threads/${t.id}/messages`, { text: 'Yes, welcome' });
	return t.id;
};
const invite = (owner, threadId, role = 'cto') => owner.post('/teams/invites', { threadId, role });

test('invites go out only from an active co-founder chat about your own idea', async () => {
	const fay = await newUser('founder', 'Fay');
	const cole = await newUser('founder', 'Cole');
	const ivan = await newUser('investor', 'Ivan');
	const ideaId = await newIdea(fay);

	const pending = await askToJoin(fay, cole, ideaId, { reply: false });
	assert.equal((await invite(fay, pending)).body.code, 'NOT_A_COFOUNDER_CHAT'); // still a request
	await fay.post(`/threads/${pending}/messages`, { text: 'Hi' });
	assert.equal((await invite(cole, pending)).status, 403); // not Cole's idea
	assert.equal((await invite(fay, pending, '  ')).status, 400); // a role is needed

	const investorChat = (await ivan.post('/threads', { ideaId, text: 'Hello' })).body.thread.id;
	await fay.post(`/threads/${investorChat}/messages`, { text: 'Hi' });
	assert.equal((await invite(fay, investorChat)).body.code, 'NOT_A_COFOUNDER_CHAT');
	assert.equal((await ivan.post('/teams/invites', { threadId: investorChat, role: 'cto' })).status, 403);

	const stranger = await newUser('founder', 'Sam');
	assert.equal((await invite(stranger, pending)).status, 404);
	assert.equal(await TeamInvite.countDocuments({}), 0);
});

test("nobody joins until they accept; accepting twice adds them once", async () => {
	const fay = await newUser('founder', 'Fay');
	const cole = await newUser('founder', 'Cole');
	const ideaId = await newIdea(fay);
	const threadId = await askToJoin(fay, cole, ideaId);

	const sent = await invite(fay, threadId, 'cto');
	assert.equal(sent.status, 201);
	assert.equal(sent.body.invite.role, 'CTO');
	assert.equal((await invite(fay, threadId, 'cto')).status, 200, 'the open invite, not a second one');
	assert.equal(await Team.countDocuments({}), 0, 'no team, no member, before an accept');

	const incoming = (await cole.get('/teams/invites')).body;
	assert.deepEqual(incoming.map((i) => [i.idea.title, i.role, i.other.name, i.direction]), [['Campus compost', 'CTO', 'Fay', 'incoming']]);
	assert.equal((await fay.post(`/teams/invites/${sent.body.invite.id}/accept`)).status, 404, 'only the invitee accepts');

	const accepts = await Promise.all([1, 2, 3].map(() => cole.post(`/teams/invites/${sent.body.invite.id}/accept`)));
	assert.equal(accepts.filter((r) => r.status === 200).length, 1);
	const team = await Team.findOne({ idea_id: ideaId }).lean();
	assert.deepEqual(team.members.map((m) => [m.name, m.kind, m.role]), [['Fay', 'owner', 'Founder'], ['Cole', 'member', 'CTO']]);
	assert.deepEqual((await BaseUser.findById(cole.id).lean()).teams.map(String), [String(team._id)]);

	const msgs = (await fay.get(`/threads/${threadId}/messages`)).body.filter((m) => m.kind === 'event').map((m) => m.text);
	assert.deepEqual(msgs, ['Fay invited Cole to join the team as CTO.', 'Cole joined the team.']);
	await settle();
	assert.ok((await BaseUser.findById(cole.id).lean()).notifications.some((n) => n.text === 'Fay invited you to join “Campus compost” as CTO' && n.link === '/founder/teams'));
	assert.ok((await BaseUser.findById(fay.id).lean()).notifications.some((n) => n.text === 'Cole joined “Campus compost” as CTO'));

	const mine = (await cole.get('/teams/mine')).body;
	assert.equal(mine[0].isOwner, false);
	assert.deepEqual(mine[0].members.map((m) => [m.name, m.kind, m.isYou]), [['Fay', 'owner', false], ['Cole', 'member', true]]);
	assert.equal((await invite(fay, threadId)).body.code, 'ALREADY_MEMBER');
});

test('two people accepting at once make one team', async () => {
	const fay = await newUser('founder', 'Fay');
	const ideaId = await newIdea(fay);
	const [cole, dee] = [await newUser('founder', 'Cole'), await newUser('founder', 'Dee')];
	const a = (await invite(fay, await askToJoin(fay, cole, ideaId))).body.invite.id;
	const b = (await invite(fay, await askToJoin(fay, dee, ideaId))).body.invite.id;
	await Promise.all([cole.post(`/teams/invites/${a}/accept`), dee.post(`/teams/invites/${b}/accept`)]);
	const teams = await Team.find({ idea_id: ideaId }).lean();
	assert.equal(teams.length, 1);
	assert.equal(teams[0].members.length, 3);
});

test('decline, revoke, remove and leave; the founder cannot leave', async () => {
	const fay = await newUser('founder', 'Fay');
	const cole = await newUser('founder', 'Cole');
	const ideaId = await newIdea(fay);
	const threadId = await askToJoin(fay, cole, ideaId);

	const first = (await invite(fay, threadId)).body.invite.id;
	assert.equal((await cole.post(`/teams/invites/${first}/decline`)).status, 200);
	assert.equal((await cole.post(`/teams/invites/${first}/accept`)).body.code, 'NOT_PENDING');
	const second = (await invite(fay, threadId, 'designer')).body.invite.id; // a new invite is fine
	assert.equal((await fay.post(`/teams/invites/${second}/revoke`)).status, 200);
	assert.equal((await cole.get('/teams/invites')).body.length, 0);
	assert.deepEqual((await fay.get('/teams/invites?box=outgoing')).body.map((i) => i.status), ['revoked', 'declined']);

	const third = (await invite(fay, threadId, 'Growth')).body.invite.id; // the founder's own words
	await cole.post(`/teams/invites/${third}/accept`);
	const teamId = (await fay.get('/teams/mine')).body[0].id;
	assert.equal((await cole.get(`/teams/${teamId}`)).status, 200);
	assert.equal((await (await newUser('founder', 'Sam')).get(`/teams/${teamId}`)).status, 404, 'members only');

	assert.equal((await fay.post(`/teams/${teamId}/leave`)).body.code, 'OWNER_CANNOT_LEAVE');
	assert.equal((await cole.del(`/teams/${teamId}/members/${fay.id}`)).body.code, 'NOT_OWNER');
	assert.equal((await fay.del(`/teams/${teamId}/members/${cole.id}`)).status, 200);
	assert.equal((await cole.get(`/teams/${teamId}`)).status, 404);
	assert.deepEqual((await BaseUser.findById(cole.id).lean()).teams, []);

	// Back again, then leaving.
	const fourth = (await invite(fay, threadId)).body.invite.id;
	await cole.post(`/teams/invites/${fourth}/accept`);
	assert.equal((await cole.post(`/teams/${teamId}/leave`)).status, 200);
	assert.equal((await Team.findById(teamId).lean()).members.length, 1);
});

test('the old routes that added people without asking are gone', async () => {
	const fay = await newUser('founder', 'Fay');
	const cole = await newUser('founder', 'Cole');
	const ideaId = await newIdea(fay);
	assert.equal((await fay.post('/teams', { idea_id: ideaId, name: 'Crew' })).status, 404);
	assert.equal((await fay.post(`/teams/${new mongoose.Types.ObjectId()}/members`, { user_id: cole.id, role: 'cto' })).status, 404);
});

test('the duplicate-team clean-up keeps one team per idea with everyone on it', async () => {
	const fay = await newUser('founder', 'Fay');
	const cole = await newUser('founder', 'Cole');
	const ideaId = new mongoose.Types.ObjectId(await newIdea(fay));
	await Team.collection.dropIndex('idea_id_1');
	try {
		const now = Date.now();
		const t1 = await Team.collection.insertOne({ idea_id: ideaId, founder_id: new mongoose.Types.ObjectId(fay.id), members: [{ user_id: new mongoose.Types.ObjectId(fay.id), name: 'Fay' }], createdAt: new Date(now - 1000) });
		const t2 = await Team.collection.insertOne({ idea_id: ideaId, founder_id: new mongoose.Types.ObjectId(fay.id), members: [{ user_id: new mongoose.Types.ObjectId(fay.id), name: 'Fay' }, { user_id: new mongoose.Types.ObjectId(cole.id), name: 'Cole' }], createdAt: new Date(now) });
		await BaseUser.collection.updateOne({ _id: new mongoose.Types.ObjectId(cole.id) }, { $set: { teams: [t2.insertedId] } });

		const { dedupe } = require('../scripts/dedupe-teams.js');
		assert.deepEqual(await dedupe({ log: () => {} }), { ideas: 1, removed: 1 });
		assert.equal(await Team.countDocuments({}), 2, 'a dry run changes nothing');
		await dedupe({ apply: true, log: () => {} });
		const left = await Team.find({}).lean();
		assert.equal(left.length, 1);
		assert.equal(String(left[0]._id), String(t1.insertedId), 'the oldest is kept');
		assert.deepEqual(left[0].members.map((m) => m.name), ['Fay', 'Cole']);
		assert.deepEqual((await BaseUser.findById(cole.id).lean()).teams.map(String), [String(t1.insertedId)]);
	} finally {
		await Team.syncIndexes();
	}
});
