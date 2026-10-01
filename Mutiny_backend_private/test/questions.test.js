const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, resetDb, agent, baseUrl } = require('./helpers/server.js');

let Founder, Investor, Idea;

before(async () => {
	await start();
	({ Founder, Investor } = require('../src/models/user.model.js'));
	({ Idea } = require('../src/models/ideas.model.js'));
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

// The agent helper doesn't send custom headers, so time-travel requests use fetch directly.
const at = async (a, iso, path, method = 'GET', body) => {
	const res = await fetch(baseUrl() + path, {
		method,
		headers: {
			'content-type': 'application/json',
			'x-dev-now': iso,
			cookie: [...a.jar].map(([k, v]) => `${k}=${v}`).join('; '),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	return { status: res.status, body: await res.json() };
};

test('one daily question: same on reload, answered once, then nothing until tomorrow', async () => {
	const fay = await newUser('founder', 'Fay');
	const q1 = (await at(fay, '2026-09-30T09:00:00Z', '/questions/next?tz=UTC')).body.question;
	assert.equal(q1.id, 'f_sectors');
	assert.equal(q1.reason, 'daily');
	assert.ok(q1.options.some((o) => o.value === 'ai_ml' && o.label === 'AI / ML'));

	const reload = (await at(fay, '2026-09-30T10:00:00Z', '/questions/next')).body.question;
	assert.equal(reload.id, 'f_sectors');

	const ans = await at(fay, '2026-09-30T10:01:00Z', `/questions/${q1.id}/answer`, 'POST', { value: ['ai_ml', 'climate'] });
	assert.equal(ans.status, 200, JSON.stringify(ans.body));
	const doc = await Founder.findById(fay.id).lean();
	assert.deepEqual(doc.interests, ['ai_ml', 'climate']);
	assert.equal(doc.fieldSources.interests.source, 'question');

	const after = (await at(fay, '2026-09-30T18:00:00Z', '/questions/next')).body;
	assert.equal(after.question, null);
	assert.equal(after.reason, 'done_today');

	const tomorrow = (await at(fay, '2026-10-01T09:00:00Z', '/questions/next')).body.question;
	assert.equal(tomorrow.id, 'f_skills', 'the answered field is never asked again');
});

test('invalid answers are rejected and nothing is saved', async () => {
	const ivan = await newUser('investor', 'Ivan');
	await ivan.get('/questions/next');
	const bad = await ivan.post('/questions/i_sectors/answer', { value: ['not_a_sector'] });
	assert.equal(bad.status, 422);
	const tooMany = await ivan.post('/questions/i_stages/answer', { value: ['angel', 'pre_seed', 'seed', 'series_a', 'grants'] });
	assert.equal(tooMany.status, 422);
	assert.equal((await ivan.post('/questions/f_sectors/answer', { value: ['ai_ml'] })).status, 403, 'founder question for an investor');
	assert.deepEqual((await Investor.findById(ivan.id).lean()).interests, []);
});

test('check size writes min/max; a profile edit makes the question disappear', async () => {
	const ivan = await newUser('investor', 'Ivan');
	const res = await ivan.post('/questions/i_check_size/answer', { value: '25k_100k' });
	assert.equal(res.status, 200, JSON.stringify(res.body));
	const doc = await Investor.findById(ivan.id).lean();
	assert.equal(doc.minCheck, 25000);
	assert.equal(doc.maxCheck, 100000);

	await ivan.put('/investor/interests', { interests: ['fintech'] });
	const jit = (await ivan.get('/questions/next?context=investor_matching')).body.question;
	assert.notEqual(jit?.id, 'i_sectors', 'sectors typed on the profile page are not asked again');
	assert.equal(jit.id, 'i_stages');
	assert.equal(jit.contextLabel, 'Investor matching');
});

test('"Don\'t ask again" retires a question; 3 skips in a row pause the daily question', async () => {
	const ivan = await newUser('investor', 'Ivan');
	await at(ivan, '2026-09-30T09:00:00Z', '/questions/i_sectors/skip', 'POST', { mode: 'never' });
	const more = (await at(ivan, '2026-09-30T09:01:00Z', '/questions/next?context=more')).body.question;
	assert.notEqual(more.id, 'i_sectors');

	await at(ivan, '2026-09-30T09:02:00Z', '/questions/i_stages/skip', 'POST', { mode: 'skip' });
	const third = await at(ivan, '2026-09-30T09:03:00Z', '/questions/i_check_size/skip', 'POST', { mode: 'skip' });
	assert.ok(third.body.pausedUntil, '3 in a row → paused');

	const paused = (await at(ivan, '2026-10-01T09:00:00Z', '/questions/next')).body;
	assert.equal(paused.question, null);
	assert.equal(paused.reason, 'paused');
	const back = (await at(ivan, '2026-10-04T09:00:00Z', '/questions/next')).body.question;
	assert.ok(back, 'asks again after the pause');
	assert.notEqual(back.id, 'i_sectors');
});

test('idea questions write to the founder\'s idea', async () => {
	const fay = await newUser('founder', 'Fay');
	await fay.put('/founder/profile', { interests: ['ai_ml'] });
	const idea = (await fay.post('/ideas', { title: 'Edge Vision', description: 'Vision kits' })).body;
	const q = (await fay.get('/questions/next?context=publish_idea')).body.question;
	assert.equal(q.id, 'idea_stage');
	assert.equal(q.entityId, idea._id);
	assert.match(q.prompt, /Edge Vision/);

	const res = await fay.post(`/questions/idea_stage/answer`, { value: 'prototype', entityId: q.entityId });
	assert.equal(res.status, 200, JSON.stringify(res.body));
	assert.equal((await Idea.findById(idea._id).lean()).stage, 'prototype');

	const cole = await newUser('founder', 'Cole');
	const hijack = await cole.post('/questions/idea_stage/answer', { value: 'mvp', entityId: idea._id });
	assert.equal(hijack.status, 404, 'cannot answer for someone else\'s idea');
	assert.equal((await Idea.findById(idea._id).lean()).stage, 'prototype');
});

test('a session can keep going: "more" keeps giving the next question after answers', async () => {
	const fay = await newUser('founder', 'Fay');
	const seen = new Set();
	for (let i = 0; i < 4; i++) {
		const q = (await fay.get('/questions/next?context=more&tz=UTC')).body.question;
		assert.ok(q, `question ${i + 1}`);
		assert.ok(!seen.has(`${q.id}:${q.entityId}`), 'never the same one twice');
		seen.add(`${q.id}:${q.entityId}`);
		const value = q.type === 'chips' ? [q.options[0].value].slice(0, q.select?.max ?? 1) : q.type === 'yes_no' ? q.options[0].value : 'https://www.linkedin.com/in/fay';
		const r = await fay.post(`/questions/${q.id}/answer`, { value: q.select?.max === 1 ? q.options[0].value : value, entityId: q.entityId, context: 'more' });
		if (r.status !== 200) {
			// A free-text question that needs a specific format: skip it and carry on, as the box does.
			await fay.post(`/questions/${q.id}/skip`, { mode: 'later', entityId: q.entityId });
		}
	}
});

test('progress counts answered questions per area; "never" stops counting against you', async () => {
	const fay = await newUser('founder', 'Fay');
	const before = (await fay.get('/questions/progress')).body;
	assert.ok(before.total > 0);
	assert.equal(before.answered, 0);
	assert.ok(before.areas.every((a) => a.label && a.total > 0));

	await fay.put('/founder/profile', { interests: ['climate'] });
	const after = (await fay.get('/questions/progress')).body;
	assert.equal(after.answered, 1, 'sectors now count as answered');

	await fay.post('/questions/f_github/skip', { mode: 'never' });
	const third = (await fay.get('/questions/progress')).body;
	assert.equal(third.total, after.total - 1);
});

test('taking a break stops the daily question until tomorrow but asking still works', async () => {
	const fay = await newUser('founder', 'Fay');
	const r = await at(fay, '2026-09-30T09:00:00Z', '/questions/rest', 'POST', {});
	assert.equal(r.status, 200);
	assert.equal(new Date(r.body.pausedUntil).toISOString(), '2026-10-01T00:00:00.000Z');
	assert.equal((await at(fay, '2026-09-30T15:00:00Z', '/questions/next?tz=UTC')).body.reason, 'paused');
	assert.ok((await at(fay, '2026-09-30T15:00:00Z', '/questions/next?tz=UTC&context=more')).body.question, '"more" still answers');
	assert.ok((await at(fay, '2026-10-01T09:00:00Z', '/questions/next?tz=UTC')).body.question, 'back the next day');
});
