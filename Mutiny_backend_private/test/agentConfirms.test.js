// R12 confirms in the Something box: the agent proposes ("Stage: Prototype → MVP, right?"),
// the box shows it before any other question, and the founder's answer goes back to the agent.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, resetDb, agent, internal, baseUrl, fakeAgent } = require('./helpers/server.js');

let QuestionState;
before(async () => {
	await start();
	({ QuestionState } = require('../src/models/questionState.model.js'));
});
after(stop);
beforeEach(resetDb);

const newFounder = async (name) => {
	const a = agent();
	const res = await a.post('/auth/signup', { name, email: `${name.toLowerCase()}@example.test`, password: 'long enough pw', role: 'founder', accepted_terms: true });
	assert.equal(res.status, 201);
	a.id = res.body.user._id;
	return a;
};

const propose = (userId, confirmId, extra = {}) => internal('PUT', `/internal/questions/${confirmId}`, {
	userId, prompt: 'Stage: Prototype → MVP, right?', slot: 'idea.stage', current: 'Prototype', proposed: 'MVP',
	expiresAt: new Date(Date.now() + 864e5).toISOString(), ...extra,
});

const at = async (a, path, method = 'GET', body) => {
	const res = await fetch(baseUrl() + path, {
		method,
		headers: { 'content-type': 'application/json', cookie: [...a.jar].map(([k, v]) => `${k}=${v}`).join('; ') },
		body: body ? JSON.stringify(body) : undefined,
	});
	return { status: res.status, body: await res.json() };
};

test('a pending confirm comes first, as a one-tap confirm, without using the daily question', async () => {
	const fay = await newFounder('Fay');
	assert.equal((await propose(fay.id, 'c0123456789abcdef')).status, 200);
	const q = (await at(fay, '/questions/next?tz=UTC')).body.question;
	assert.equal(q.id, 'agent:c0123456789abcdef');
	assert.equal(q.type, 'confirm');
	assert.equal(q.reason, 'confirm');
	assert.equal(q.prompt, 'Stage: Prototype → MVP, right?');
	assert.deepEqual(q.options.map((o) => o.value), ['yes', 'change']);

	const ans = await at(fay, `/questions/${encodeURIComponent(q.id)}/answer`, 'POST', { value: { choice: 'yes' } });
	assert.equal(ans.status, 200, JSON.stringify(ans.body));
	assert.deepEqual(fakeAgent().confirms.at(-1), { id: 'c0123456789abcdef', choice: 'yes', user: fay.id });
	const daily = (await at(fay, '/questions/next?tz=UTC')).body.question;
	assert.equal(daily.reason, 'daily', 'the daily question is still there');

	await propose(fay.id, 'c0123456789abcdef');
	const st = await QuestionState.findOne({ questionId: 'agent:c0123456789abcdef' }).lean();
	assert.equal(st.status, 'answered', 're-sending a confirm never re-opens it');
});

test('"Not quite" needs the right value; "skip" tells the agent to leave memory alone', async () => {
	const fay = await newFounder('Fay');
	await propose(fay.id, 'c1111111111111111');
	assert.equal((await at(fay, '/questions/agent%3Ac1111111111111111/answer', 'POST', { value: { choice: 'change' } })).status, 400);
	assert.equal((await at(fay, '/questions/agent%3Ac1111111111111111/answer', 'POST', { value: { choice: 'change', value: 'Launched' } })).status, 200);
	assert.deepEqual(fakeAgent().confirms.at(-1), { id: 'c1111111111111111', choice: 'change', value: 'Launched', user: fay.id });

	await propose(fay.id, 'c2222222222222222');
	const later = await at(fay, '/questions/agent%3Ac2222222222222222/skip', 'POST', { mode: 'later' });
	assert.equal(later.body.status, 'snoozed');
	assert.equal(fakeAgent().confirms.length, 1, '"Not now" doesn\'t resolve it');
	await QuestionState.updateOne({ questionId: 'agent:c2222222222222222' }, { $set: { snoozedUntil: new Date(Date.now() - 1000) } });
	const never = await at(fay, '/questions/agent%3Ac2222222222222222/skip', 'POST', { mode: 'never' });
	assert.equal(never.body.status, 'never');
	assert.deepEqual(fakeAgent().confirms.at(-1), { id: 'c2222222222222222', choice: 'skip', user: fay.id });
});

test("someone else's or an expired confirm isn't shown or answerable", async () => {
	const fay = await newFounder('Fay');
	const kai = await newFounder('Kai');
	await propose(fay.id, 'c3333333333333333');
	assert.equal((await at(kai, '/questions/agent%3Ac3333333333333333/answer', 'POST', { value: { choice: 'yes' } })).status, 404);
	await propose(kai.id, 'c4444444444444444', { expiresAt: new Date(Date.now() - 1000).toISOString() });
	const q = (await at(kai, '/questions/next?tz=UTC')).body.question;
	assert.notEqual(q?.id, 'agent:c4444444444444444');
	assert.equal((await internal('PUT', '/internal/questions/not-a-confirm', { userId: fay.id, prompt: 'x' })).status, 400);
	assert.equal((await internal('DELETE', '/internal/questions/c3333333333333333')).status, 200);
	assert.equal(await QuestionState.countDocuments({ questionId: 'agent:c3333333333333333' }), 0);
});

test('the agent being down keeps the confirm open', async () => {
	const fay = await newFounder('Fay');
	await propose(fay.id, 'c5555555555555555');
	fakeAgent().down = true;
	const res = await at(fay, '/questions/agent%3Ac5555555555555555/answer', 'POST', { value: { choice: 'yes' } });
	assert.equal(res.status, 503);
	assert.equal((await QuestionState.findOne({ questionId: 'agent:c5555555555555555' }).lean()).status, 'open');
});
