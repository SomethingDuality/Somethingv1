const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, resetDb, agent, settle } = require('./helpers/server.js');
const { joinTeam } = require('./helpers/teams.js');

let Investor;

before(async () => {
	await start();
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
const newIdea = async (fay, title = 'Campus compost') => {
	const res = await fay.post('/ideas', { title, description: 'Composting for canteens.', isDraft: false });
	assert.equal(res.status, 201, JSON.stringify(res.body));
	return res.body._id;
};

test('founder overview: real totals per idea, team without duplicates, and real activity', async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	const mo = await newUser('founder', 'Mo');
	const a = await newIdea(fay, 'Campus compost');
	const b = await newIdea(fay, 'Solar kiosks');

	await ivan.post(`/ideas/${a}/like`);
	await ivan.post(`/ideas/${a}/comments`, { text: 'Who pays per kilo?' });
	assert.equal((await ivan.post('/investor/commit', { ideaId: a, amount: 500 })).status, 201);
	for (const idea of [a, b]) await joinTeam(fay, mo, idea, 'Engineer');
	await settle();

	const res = await fay.get('/founder/overview');
	assert.equal(res.status, 200, JSON.stringify(res.body));
	const { kpis, totals, ideas, team, activity, committedByIdea } = res.body;
	assert.equal(kpis.ideas, 2);
	assert.equal(kpis.teamMembers, 1, 'Mo once, the founder not counted');
	assert.deepEqual(totals, { committed: 500, released: 0, investors: 1 });
	assert.equal(ideas.find((i) => i.title === 'Campus compost').committed, 500);
	assert.equal(ideas.find((i) => i.title === 'Solar kiosks').committed, 0, 'no more founder-wide totals on every idea');
	assert.equal(committedByIdea[a], 500);
	assert.equal(team.length, 2, 'Fay (You) and Mo');
	assert.ok(team.find((m) => m.isYou));

	const kinds = activity.map((x) => x.kind);
	for (const k of ['like', 'comment', 'commit', 'team']) assert.ok(kinds.includes(k), `${k} in ${kinds}`);
	assert.ok(activity.find((x) => x.kind === 'like').text.startsWith('Someone supported'), 'supporters stay anonymous');
	assert.match(activity.find((x) => x.kind === 'commit').text, /^Ivan committed \$500 to “Campus compost”/);
	assert.equal(kpis.needsYou, (await fay.get('/notifications')).body.filter((n) => !n.read).length);
});

test('notifications: reading marks them read instead of deleting; clearing deletes', async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	const a = await newIdea(fay);
	await ivan.post('/investor/commit', { ideaId: a, amount: 500 });
	await ivan.post(`/ideas/${a}/comments`, { text: 'Nice' });
	await settle();

	let list = (await fay.get('/notifications')).body;
	assert.equal(list.length, 2);
	assert.ok(list.every((n) => n.read === false));

	assert.equal((await fay.post(`/notifications/mark-read/${list[0].id}`)).status, 200);
	list = (await fay.get('/notifications')).body;
	assert.equal(list.length, 2, 'still there');
	assert.equal(list.filter((n) => n.read).length, 1);

	await fay.post('/notifications/mark-all-read');
	list = (await fay.get('/notifications')).body;
	assert.ok(list.every((n) => n.read));

	assert.equal((await fay.del(`/notifications/${list[0].id}`)).status, 200);
	assert.equal((await fay.get('/notifications')).body.length, 1);
	assert.equal((await fay.del('/notifications')).status, 200);
	assert.equal((await fay.get('/notifications')).body.length, 0);
	assert.equal((await fay.post('/notifications/mark-read/not-an-id')).status, 400);
});

test('an idea carries the founder card, the team and a commitment total', async () => {
	const fay = await newUser('founder', 'Fay');
	await fay.put('/founder/profile', { headline: 'Builds compost loops', location: 'Pune', socials: { linkedin: 'https://www.linkedin.com/in/fay' } });
	const ivan = await newUser('investor', 'Ivan');
	const olga = await newUser('investor', 'Olga');
	const a = await newIdea(fay);
	await ivan.post('/investor/commit', { ideaId: a, amount: 500 });
	await olga.post('/investor/commit', { ideaId: a, amount: 1500 });
	await joinTeam(fay, await newUser('founder', 'Mo'), a, 'Engineer');

	const res = await ivan.get(`/ideas/${a}`);
	assert.equal(res.status, 200);
	assert.equal(res.body.founder.name, 'Fay');
	assert.equal(res.body.founder.location, 'Pune');
	assert.equal(res.body.founder.links.linkedin, 'https://www.linkedin.com/in/fay');
	assert.equal(res.body.founder.email, undefined, 'no email on the card');
	assert.deepEqual(res.body.commitments, { count: 2, total: 2000, released: 0 });
	assert.deepEqual(res.body.team.map((m) => m.name), ['Fay', 'Mo']);
});

test('watchlist: saved on the server, drafts refused, cleaned up when the idea is deleted', async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	const a = await newIdea(fay);
	const draft = (await fay.post('/ideas', { title: 'Secret', description: 'Not yet.', isDraft: true })).body._id;

	assert.equal((await ivan.post(`/investor/watchlist/${a}`)).status, 200);
	assert.equal((await ivan.post(`/investor/watchlist/${a}`)).status, 200, 'saving twice is fine');
	assert.equal((await ivan.post(`/investor/watchlist/${draft}`)).status, 404);
	assert.equal((await fay.post(`/investor/watchlist/${a}`)).status, 403, 'investors only');
	let w = (await ivan.get('/investor/watchlist')).body;
	assert.deepEqual(w.ids, [a]);
	assert.equal(w.ideas[0].title, 'Campus compost');

	await fay.del(`/ideas/${a}`);
	assert.deepEqual((await Investor.findById(ivan.id).lean()).watchlist, []);

	const b = await newIdea(fay, 'Solar kiosks');
	await ivan.post(`/investor/watchlist/${b}`);
	assert.equal((await ivan.del(`/investor/watchlist/${b}`)).status, 200);
	w = (await ivan.get('/investor/watchlist')).body;
	assert.deepEqual(w.ids, []);
});
