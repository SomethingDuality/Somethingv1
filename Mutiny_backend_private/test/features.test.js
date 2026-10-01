const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, resetDb, agent, settle } = require('./helpers/server.js');

let IdeaUpdate;

before(async () => {
	await start();
	({ IdeaUpdate } = require('../src/models/ideaUpdate.model.js'));
});
after(stop);
beforeEach(resetDb);

const newUser = async (role, name) => {
	const a = agent();
	a.email = `${name.toLowerCase()}@example.test`;
	const res = await a.post('/auth/signup', { name, email: a.email, password: 'long enough pw', role, accepted_terms: true });
	assert.equal(res.status, 201);
	a.id = res.body.user._id;
	return a;
};
const newIdea = async (fay, extra = {}) => {
	const res = await fay.post('/ideas', { title: 'Campus compost', description: 'Composting for canteens.', isDraft: false, ...extra });
	assert.equal(res.status, 201, JSON.stringify(res.body));
	return res.body._id;
};
const texts = async (a) => (await a.get('/notifications')).body.map((n) => n.text);

test('founder updates reach savers and committers; investors can ask once a week', async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');   // commits
	const sara = await newUser('investor', 'Sara');   // saves
	const olga = await newUser('investor', 'Olga');   // neither
	const id = await newIdea(fay);
	await ivan.post('/investor/commit', { ideaId: id, amount: 500 });
	await sara.post(`/investor/watchlist/${id}`);

	assert.equal((await ivan.post(`/ideas/${id}/updates`, { text: 'Hi' })).status, 403, 'only the founder posts');
	assert.equal((await fay.post(`/ideas/${id}/updates`, { text: '   ' })).status, 400);
	const posted = await fay.post(`/ideas/${id}/updates`, { text: 'First 10 canteens signed.' });
	assert.equal(posted.status, 201, JSON.stringify(posted.body));
	await settle();

	for (const a of [ivan, sara]) assert.ok((await texts(a)).some((t) => /Fay posted an update on “Campus compost”: First 10 canteens signed\./.test(t)));
	assert.equal((await texts(olga)).length, 0, 'nobody else is told');
	assert.deepEqual((await olga.get(`/ideas/${id}/updates`)).body.map((u) => u.text), ['First 10 canteens signed.']);

	for (let i = 0; i < 4; i++) assert.equal((await fay.post(`/ideas/${id}/updates`, { text: `More ${i}` })).status, 201);
	assert.equal((await fay.post(`/ideas/${id}/updates`, { text: 'Too many' })).status, 429, 'five a day per idea');

	assert.equal((await fay.del(`/ideas/${id}/updates/${posted.body.id}`)).status, 200);
	assert.equal((await fay.get(`/ideas/${id}/updates`)).body.length, 4);

	// Request an update: investors only, once a week per idea.
	assert.equal((await fay.post(`/ideas/${id}/request-update`)).status, 403);
	assert.equal((await ivan.post(`/ideas/${id}/request-update`)).body.sent, true);
	assert.equal((await ivan.post(`/ideas/${id}/request-update`)).body.sent, false);
	assert.equal((await texts(fay)).filter((t) => t === 'Ivan asked for an update on “Campus compost”').length, 1);

	// A draft's updates stay with the founder, and everything goes when the idea is deleted.
	const draft = await newIdea(fay, { title: 'Secret', isDraft: true });
	await fay.post(`/ideas/${draft}/updates`, { text: 'Note to self' });
	assert.equal((await ivan.get(`/ideas/${draft}/updates`)).status, 404);
	await fay.del(`/ideas/${id}`);
	assert.equal(await IdeaUpdate.countDocuments({ idea_id: id }), 0);
});

test('milestones: the founder marks one done, committed investors are told and can release against it', async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	const id = await newIdea(fay);
	await ivan.post('/investor/commit', { ideaId: id, amount: 1000 });

	assert.equal((await ivan.post(`/ideas/${id}/milestones`, { title: 'Pilot' })).status, 403);
	const m = (await fay.post(`/ideas/${id}/milestones`, { title: 'First 10 canteens' })).body;
	assert.equal(m.status, 'open');

	const inv = (await ivan.get('/investor/portfolio')).body.data[0];
	assert.equal(inv.milestones[0].title, 'First 10 canteens');
	assert.equal((await ivan.post(`/investor/portfolio/${inv.id}/release`, { amount: 200, milestoneId: m.id })).status, 409, 'not done yet');

	const done = await fay.put(`/ideas/${id}/milestones/${m.id}`, { status: 'done', proof: 'https://example.com/signed' });
	assert.equal(done.status, 200);
	assert.ok(done.body.doneAt);
	await settle();
	assert.ok((await texts(ivan)).includes('“Campus compost” finished “First 10 canteens”. You can record a release for it.'));

	const rel = await ivan.post(`/investor/portfolio/${inv.id}/release`, { amount: 200, milestoneId: m.id });
	assert.equal(rel.status, 200, JSON.stringify(rel.body));
	const row = (await ivan.get('/investor/portfolio')).body.data[0];
	assert.equal(row.released, 200);
	assert.equal(String(row.releases[0].milestoneId), String(m.id));
	assert.ok((await texts(fay)).some((t) => t.includes('(milestone “First 10 canteens”)')));
	const activity = (await fay.get('/founder/overview')).body.activity;
	assert.ok(activity.some((a) => a.kind === 'release' && /Ivan recorded a \$200 release/.test(a.text)));

	assert.equal((await fay.del(`/ideas/${id}/milestones/${m.id}`)).status, 200);
	assert.equal((await ivan.get(`/ideas/${id}`)).body.milestones.length, 0);
});

test('investor verification: LinkedIn, a hand check by an admin, and a mark founders see', async () => {
	const fay = await newUser('founder', 'Fay');      // the admin in this test
	const ivan = await newUser('investor', 'Ivan');
	const saved = process.env.ADMIN_EMAILS;
	process.env.ADMIN_EMAILS = fay.email;
	try {
		assert.equal((await fay.get('/auth/me')).body.isAdmin, true);
		assert.equal((await ivan.get('/auth/me')).body.isAdmin, false);

		assert.equal((await ivan.post('/investor/verification', {})).status, 422);
		assert.equal((await ivan.post('/investor/verification', { linkedin: 'https://example.com/ivan' })).status, 422);
		const sub = await ivan.post('/investor/verification', { linkedin: 'linkedin.com/in/ivan' });
		assert.equal(sub.status, 200, JSON.stringify(sub.body));
		assert.equal(sub.body.verification.status, 'pending');
		assert.equal(sub.body.linkedin, 'https://linkedin.com/in/ivan');
		await settle();
		assert.ok((await texts(fay)).includes('Ivan asked to be verified'));

		assert.equal((await ivan.get('/admin/verifications')).status, 404, 'non-admins get a 404');
		const pending = (await fay.get('/admin/verifications')).body;
		assert.deepEqual(pending.map((p) => p.name), ['Ivan']);
		assert.equal((await fay.post(`/admin/verifications/${ivan.id}`, { decision: 'reject' })).status, 400, 'a decline needs a reason');
		assert.equal((await fay.post(`/admin/verifications/${ivan.id}`, { decision: 'verify' })).status, 200);
		assert.equal((await ivan.get('/investor/profile')).body.verification.status, 'verified');
		assert.equal((await ivan.post('/investor/verification', { linkedin: 'linkedin.com/in/ivan2' })).status, 409);

		const id = await newIdea(fay);
		await ivan.post('/investor/commit', { ideaId: id, amount: 500 });
		assert.ok((await texts(fay)).some((t) => t.startsWith('Ivan, verified investor committed $500')));
	} finally {
		if (saved === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = saved;
	}
});

test('raising band on ideas, and the founder location on Discover as a clean id', async () => {
	const fay = await newUser('founder', 'Fay');
	const mo = await newUser('founder', 'Mo');
	await fay.put('/founder/profile', { location: 'Koramangala, Bangalore' });
	await mo.put('/founder/profile', { location: 'Atlantis' });
	const a = await newIdea(fay, { raising: '$25k – $100k' });
	await newIdea(mo, { title: 'Sea farms' });

	assert.equal((await fay.get(`/ideas/${a}`)).body.raising, '25k_100k', 'labels normalize to the band id');
	assert.equal((await fay.put(`/ideas/${a}`, { raising: 'a lot' })).status, 422);
	assert.equal((await fay.put(`/ideas/${a}`, { raising: 'not_raising' })).status, 200);

	const ideas = (await agent().get('/ideas/discover')).body;
	const byTitle = Object.fromEntries(ideas.map((i) => [i.title, i]));
	assert.equal(byTitle['Campus compost'].founderLocation, 'Koramangala, Bangalore');
	assert.equal(byTitle['Campus compost'].locationId, 'bengaluru');
	assert.equal(byTitle['Sea farms'].locationId, 'other');
	assert.equal(byTitle['Campus compost'].raising, 'not_raising');
});

test('founder funding: per idea, who committed, what was released and against which milestone', async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	const id = await newIdea(fay);
	await newIdea(fay, { title: 'Solar kiosks' });
	await ivan.post('/investor/commit', { ideaId: id, amount: 1000 });
	const m = (await fay.post(`/ideas/${id}/milestones`, { title: 'Pilot' })).body;
	await fay.put(`/ideas/${id}/milestones/${m.id}`, { status: 'done' });
	const inv = (await ivan.get('/investor/portfolio')).body.data[0];
	await ivan.post(`/investor/portfolio/${inv.id}/release`, { amount: 300, milestoneId: m.id });

	assert.equal((await ivan.get('/founder/funding')).status, 403, 'founders only');
	const res = await fay.get('/founder/funding');
	assert.equal(res.status, 200, JSON.stringify(res.body));
	assert.deepEqual(res.body.totals, { committed: 1000, released: 300, investors: 1 });
	const compost = res.body.ideas.find((i) => i.title === 'Campus compost');
	assert.equal(compost.investors[0].name, 'Ivan');
	assert.equal(compost.investors[0].released, 300);
	assert.equal(compost.releasedByMilestone[m.id], 300);
	assert.equal(compost.milestones[0].status, 'done');
	assert.equal(res.body.ideas.find((i) => i.title === 'Solar kiosks').committed, 0);
});

test('overlaps find similar public ideas from other founders; the review waitlist is a flag', async () => {
	const fay = await newUser('founder', 'Fay');
	const mo = await newUser('founder', 'Mo');
	const ivan = await newUser('investor', 'Ivan');
	const mine = await newIdea(fay, { title: 'Campus compost', description: 'Pickup and composting for university canteens, paid per kilo of food waste.', tags: ['climate'] });
	await newIdea(mo, { title: 'Canteen waste to compost', description: 'Collect food waste from college canteens and sell the compost to farms.', tags: ['climate', 'agri_food'] });
	await newIdea(mo, { title: 'Sea farms', description: 'Seaweed farming kits for coastal villages.', isDraft: false });
	await newIdea(mo, { title: 'Secret compost canteen plan', description: 'Food waste canteen compost university.', isDraft: true });

	const byId = await fay.post('/founder/overlaps', { ideaId: mine });
	assert.equal(byId.status, 200, JSON.stringify(byId.body));
	assert.deepEqual(byId.body.matches.map((m) => m.title), ['Canteen waste to compost'], 'similar public idea only: not drafts, not unrelated, not her own');
	assert.ok(byId.body.matches[0].sharedWords.includes('compost'));
	assert.deepEqual(byId.body.matches[0].sharedSectors, ['climate']);

	const typed = await fay.post('/founder/overlaps', { text: 'seaweed kits for fishing villages on the coast' });
	assert.equal(typed.body.matches[0].title, 'Sea farms');
	assert.equal((await fay.post('/founder/overlaps', { text: '' })).status, 400);
	assert.equal((await mo.post('/founder/overlaps', { ideaId: mine })).status, 404, 'only your own saved ideas by id');
	assert.equal((await ivan.post('/founder/overlaps', { text: 'x' })).status, 403);

	assert.equal((await fay.get('/founder/review-waitlist')).body.joined, false);
	assert.equal((await fay.post('/founder/review-waitlist')).body.joined, true);
	assert.equal((await fay.get('/founder/review-waitlist')).body.joined, true);
	assert.equal((await fay.del('/founder/review-waitlist')).body.joined, false);
});
