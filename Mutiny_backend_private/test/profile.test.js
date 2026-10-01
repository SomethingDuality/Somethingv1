const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { start, stop, resetDb, agent } = require('./helpers/server.js');

let BaseUser, Founder, Investor, Idea, hashPassword;

before(async () => {
	await start();
	({ BaseUser, Founder, Investor } = require('../src/models/user.model.js'));
	({ Idea } = require('../src/models/ideas.model.js'));
	({ hashPassword } = require('../src/utils/password.util.js'));
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

test('shared taxonomy copies are in sync with shared/taxonomy.json', () => {
	execFileSync('node', [path.join(__dirname, '../../shared/sync.mjs'), '--check'], { stdio: 'pipe' });
});

test('founder profile writes normalize to taxonomy ids and record where each value came from', async () => {
	const fay = await newUser('founder', 'Fay');
	const res = await fay.put('/founder/profile', {
		skills: ['Engineering', 'AI/ML', 'engineering', 'Knitting'],
		interests: ['Edge AI', 'Local‑first'],
		socials: { github: 'github.com/fay', linkedin: 'https://www.linkedin.com/in/fay' },
		experience_level: 'senior',
	});
	assert.equal(res.status, 200, JSON.stringify(res.body));
	assert.deepEqual(res.body.skills, ['engineering', 'ai_ml', 'Knitting']);
	assert.deepEqual(res.body.interests, ['ai_ml', 'dev_tools']);
	assert.equal(res.body.socials.github, 'https://github.com/fay');
	assert.equal(res.body.experience_level, 'senior');

	const doc = await Founder.findById(fay.id).lean();
	assert.equal(doc.fieldSources.skills.source, 'profile');
	await fay.put('/founder/profile', { skills: [] });
	assert.equal((await Founder.findById(fay.id).lean()).fieldSources.skills, undefined, 'clearing forgets the source');
	assert.ok(doc.fieldSources.socials__github, 'dotted paths are stored with __');
});

test('bad values are rejected with 422 and the field name', async () => {
	const fay = await newUser('founder', 'Fay');
	const bad = await fay.put('/founder/profile', { socials: { linkedin: 'https://example.com/me' } });
	assert.equal(bad.status, 422);
	assert.equal(bad.body.field, 'socials.linkedin');
	assert.equal((await fay.put('/founder/profile', { experience_level: 'wizard' })).status, 422);
	assert.equal((await fay.put('/founder/profile', { name: '   ' })).status, 422);

	const ivan = await newUser('investor', 'Ivan');
	assert.equal((await ivan.put('/investor/preferences', { stageFocus: ['Series Z'] })).status, 422);
	assert.equal((await ivan.put('/investor/preferences', { ndaPreference: 'always' })).status, 422);
	assert.equal((await ivan.put('/investor/profile', { minCheck: 90000, maxCheck: 10000 })).status, 422);
});

test('investor writes normalize, and defaults are not reported as known', async () => {
	const ivan = await newUser('investor', 'Ivan');
	const before = await ivan.get('/investor/profile');
	assert.equal(before.body.minCheck, 5000, 'schema default still shown');
	assert.ok(!before.body.knownFields.includes('minCheck'), 'but not reported as known');

	const res = await ivan.put('/investor/preferences', { stageFocus: ['Pre‑seed', 'Seed'], vehicles: ['Direct Fund'], leadStatus: 'lead' });
	assert.equal(res.status, 200, JSON.stringify(res.body));
	assert.deepEqual(res.body.stageFocus, ['pre_seed', 'seed']);
	assert.deepEqual(res.body.vehicles, ['direct']);
	assert.ok(res.body.knownFields.includes('stageFocus'));

	assert.equal((await ivan.put('/investor/interests', { interests: ['Climate hardware', 'Bio tooling'] })).body.interests.join(), 'climate,health');
});

test('legacy signup fields show up in the profile without retyping', async () => {
	await Founder.create({
		name: 'Old Founder', email: 'old@example.test', password: await hashPassword('long enough pw'), accepted_terms: true,
		linkedin: 'https://linkedin.com/in/old', github: 'https://github.com/old', expertise: ['AI/ML', 'Design'],
	});
	await Investor.create({
		name: 'Old Investor', email: 'oldinv@example.test', password: await hashPassword('long enough pw'), accepted_terms: true,
		invest_stage: 'preseed', interests: ['Pre-seed', 'Web3'],
	});
	const f = agent();
	await f.post('/auth/login', { email: 'old@example.test', password: 'long enough pw' });
	const fp = (await f.get('/founder/profile')).body;
	assert.equal(fp.socials.linkedin, 'https://linkedin.com/in/old');
	assert.equal(fp.socials.github, 'https://github.com/old');
	assert.deepEqual(fp.skills, ['ai_ml', 'design']);

	const i = agent();
	await i.post('/auth/login', { email: 'oldinv@example.test', password: 'long enough pw' });
	const ip = (await i.get('/investor/profile')).body;
	assert.deepEqual(ip.stageFocus, ['pre_seed', 'seed']);
	assert.deepEqual(ip.interests, ['web3'], 'stages that were mixed into interests move to stageFocus');
});

test('an idea needs only a title and description; tags and roles are normalized', async () => {
	const fay = await newUser('founder', 'Fay');
	const res = await fay.post('/ideas', { title: 'Edge Vision', description: 'Cheap vision kits', tags: ['FinTech', 'AI/ML'], lookingFor: ['CTO', 'Frontend Developer'] });
	assert.equal(res.status, 201, JSON.stringify(res.body));
	assert.equal(res.body.stage, undefined);
	assert.deepEqual(res.body.tags, ['fintech', 'ai_ml']);
	assert.deepEqual(res.body.lookingFor, ['cto', 'frontend']);
	assert.equal((await fay.post('/ideas', { title: 'x', description: 'y', stage: 'unicorn' })).status, 422);

	// A form that sends empty values must not mark them as answered.
	const bare = await fay.post('/ideas', { title: 'Bare', description: 'Only the basics', stage: '', tags: [], lookingFor: [] });
	assert.equal(bare.status, 201);
	const bareDoc = await Idea.findById(bare.body._id).lean();
	assert.deepEqual(Object.keys(bareDoc.fieldSources || {}).sort(), ['description', 'title']);

	const upd = await fay.put(`/ideas/${res.body._id}`, { stage: 'MVP' });
	assert.equal(upd.status, 200);
	assert.equal(upd.body.stage, 'mvp');
	const doc = await Idea.findById(res.body._id).lean();
	assert.equal(doc.fieldSources.stage.source, 'profile');
});

test('the legacy migration is a dry run by default and idempotent when applied', async () => {
	const { migrate } = require('../scripts/migrate-profile-fields.js');
	await Founder.create({ name: 'Old', email: 'old2@example.test', password: 'x', accepted_terms: true, github: 'https://github.com/old', expertise: ['Design'] });
	await Investor.create({ name: 'Inv', email: 'inv2@example.test', password: 'x', accepted_terms: true, invest_stage: 'growth', interests: ['Robotics'], minCheck: 20000 });
	const quiet = () => {};

	const dry = await migrate({ log: quiet });
	assert.deepEqual(dry, { founders: 1, investors: 1, ideas: 0 });
	assert.equal((await Founder.findOne({ email: 'old2@example.test' }).lean()).socials.github, '', 'dry run changes nothing');

	await migrate({ apply: true, log: quiet });
	const f = await Founder.findOne({ email: 'old2@example.test' }).lean();
	assert.equal(f.socials.github, 'https://github.com/old');
	assert.deepEqual(f.skills, ['design']);
	const i = await Investor.findOne({ email: 'inv2@example.test' }).lean();
	assert.deepEqual(i.stageFocus, ['series_a', 'series_b_plus']);
	assert.deepEqual(i.interests, ['deep_tech']);
	assert.equal(i.fieldSources.minCheck.source, 'legacy');

	assert.deepEqual(await migrate({ apply: true, log: quiet }), { founders: 0, investors: 0, ideas: 0 }, 'second run is a no-op');
});

test('profile completion is derived on read and counts only what a founder can do today', async () => {
	const fay = await newUser('founder', 'Fay');
	assert.equal((await fay.get('/founder/profile')).body.profileCompletion, 20, 'a new founder already has a name');

	await Founder.updateOne({ _id: fay.id }, { $set: { githubVerified: true, walletVerified: true, profileCompletion: 99 } });
	assert.equal((await fay.get('/founder/profile')).body.profileCompletion, 20, 'verification is "Coming soon" and a stored value is ignored');

	const res = await fay.put('/founder/profile', {
		about: 'I build tools for campus libraries.',
		experience: [{ role: 'Engineer', company: 'Acme', duration: '2y', description: '' }],
		education: [{ institution: 'IIT', degree: 'BTech', duration: '4y' }],
	});
	assert.equal(res.status, 200, JSON.stringify(res.body));
	assert.equal(res.body.profileCompletion, 100);
});

test('a draft idea is visible only to its founder (X-9)', async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	const draft = await fay.post('/ideas', { title: 'Secret plan', description: 'Not ready for anyone else yet.', isDraft: true });
	assert.equal(draft.status, 201, JSON.stringify(draft.body));
	const id = draft.body._id;

	assert.equal((await fay.get(`/ideas/${id}`)).status, 200, 'the owner can open it');
	assert.equal((await ivan.get(`/ideas/${id}`)).status, 404, 'another user gets the same 404 as a missing idea');
	assert.equal((await agent().get(`/ideas/${id}`)).status, 404, 'so does an anonymous visitor');

	await fay.put(`/ideas/${id}`, { isDraft: false });
	assert.equal((await agent().get(`/ideas/${id}`)).status, 200, 'once public, anyone can open it');
});

test('commit amounts must be finite and bounded, and a second commit is a 409', async () => {
	const fay = await newUser('founder', 'Fay');
	const ivan = await newUser('investor', 'Ivan');
	const idea = await fay.post('/ideas', { title: 'Campus compost', description: 'Composting for canteens.' });
	const ideaId = idea.body._id;
	for (const amount of ['Infinity', -5, 0, 2e9, 'abc']) {
		assert.equal((await ivan.post('/investor/commit', { ideaId, amount })).status, 400, `amount ${amount}`);
	}
	assert.equal((await ivan.post('/investor/commit', { ideaId, amount: 15000 })).status, 201);
	assert.equal((await ivan.post('/investor/commit', { ideaId, amount: 15000 })).status, 409);
});
