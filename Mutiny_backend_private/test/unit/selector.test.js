const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectNext, applySkip, isKnown, stateKey } = require('../../src/questions/selector.js');
const bank = require('../../src/questions/bank.js');

const NOW = new Date('2026-09-30T10:00:00Z');
const base = (over = {}) => ({
	questions: bank.questions, role: 'Investor', user: { interests: [], minCheck: 5000 }, ideas: [], states: new Map(),
	defaults: { user: { minCheck: 5000 } }, cadence: {}, now: NOW, timezone: 'UTC', ...over,
});

test('a schema default is not an answer; a user-set value is', () => {
	assert.equal(isKnown({ minCheck: 5000 }, 'minCheck', 5000), false);
	assert.equal(isKnown({ minCheck: 20000 }, 'minCheck', 5000), true);
	assert.equal(isKnown({ minCheck: 5000, fieldSources: { minCheck: { source: 'question' } } }, 'minCheck', 5000), true);
	assert.equal(isKnown({ socials: { github: '' } }, 'socials.github', ''), false);
	assert.equal(isKnown({ fieldSources: { socials__github: { source: 'profile' } } }, 'socials.github', ''), true);
});

test('the daily question is the highest-priority unknown field, and the same one on reload', () => {
	const first = selectNext(base());
	assert.equal(first.pick.question.id, 'i_sectors');
	assert.equal(first.claimDaily, true);

	const reload = selectNext(base({ cadence: { daily: { day: '2026-09-30', questionId: 'i_sectors', entityId: null, resolved: false } } }));
	assert.equal(reload.pick.question.id, 'i_sectors');
	assert.equal(reload.claimDaily, undefined);

	const done = selectNext(base({ cadence: { daily: { day: '2026-09-30', questionId: 'i_sectors', resolved: true } } }));
	assert.equal(done.pick, null);
	assert.equal(done.nextEligibleAt.toISOString(), '2026-10-01T00:00:00.000Z');
});

test('just-in-time questions only come from the feature being used, with a daily cap', () => {
	const jit = selectNext(base({ context: 'commit_funds' }));
	assert.equal(jit.pick.question.id, 'i_check_size');
	const capped = selectNext(base({ context: 'commit_funds', cadence: { jit: { day: '2026-09-30', count: 3 } } }));
	assert.equal(capped.pick, null);
	assert.equal(capped.reason, 'jit_cap');
});

test('"ask me another" skips today\'s unresolved daily question', () => {
	const more = selectNext(base({ context: 'more', cadence: { daily: { day: '2026-09-30', questionId: 'i_sectors', resolved: false } } }));
	assert.equal(more.pick.question.id, 'i_stages');
});

test('skip modes: later → tomorrow, skip → 14 then 28 days, retired after 3 skips; never → never', () => {
	const later = applySkip({ mode: 'later', now: NOW });
	assert.equal(later.state.status, 'snoozed');
	assert.equal(later.state.snoozedUntil.toISOString(), '2026-10-01T00:00:00.000Z');
	assert.equal(later.cadence.consecutiveSkips, 0, '"Not now" does not count toward backoff');

	const s1 = applySkip({ mode: 'skip', now: NOW });
	assert.equal(Math.round((s1.state.snoozedUntil - NOW) / 864e5), 14);
	const s2 = applySkip({ state: s1.state, mode: 'skip', now: NOW });
	assert.equal(Math.round((s2.state.snoozedUntil - NOW) / 864e5), 28);
	const s3 = applySkip({ state: s2.state, mode: 'skip', now: NOW });
	assert.equal(s3.state.status, 'never');

	assert.equal(applySkip({ mode: 'never', now: NOW }).state.status, 'never');
});

test('3 skips in a row pause the box for 3 days, then 6; an answer lifts the pause', () => {
	let cadence = {};
	for (let i = 0; i < 2; i++) cadence = applySkip({ cadence, mode: 'skip', now: NOW }).cadence;
	assert.equal(cadence.pausedUntil, null);
	cadence = applySkip({ cadence, mode: 'never', now: NOW }).cadence;
	assert.equal(Math.round((new Date(cadence.pausedUntil) - NOW) / 864e5), 3);
	cadence = applySkip({ cadence, mode: 'skip', now: NOW }).cadence;
	assert.equal(Math.round((new Date(cadence.pausedUntil) - NOW) / 864e5), 6);

	const paused = selectNext(base({ cadence }));
	assert.equal(paused.pick, null);
	assert.equal(paused.reason, 'paused');
});

test('answered, retired and snoozed questions are not asked', () => {
	const states = new Map([
		[stateKey('i_sectors', null), { status: 'answered' }],
		[stateKey('i_stages', null), { status: 'never' }],
		[stateKey('i_check_size', null), { status: 'skipped', snoozedUntil: new Date('2026-10-10') }],
	]);
	assert.equal(selectNext(base({ states })).pick.question.id, 'i_firm');
});

test('idea questions target the founder\'s recent public ideas and name the idea', () => {
	const ideas = [
		{ _id: 'a1', title: 'Old draft', isDraft: true, createdAt: '2026-09-29' },
		{ _id: 'b2', title: 'Edge Vision', isDraft: false, createdAt: '2026-09-01' },
	];
	const pick = selectNext(base({ role: 'Founder', user: { interests: ['ai_ml'], fieldSources: { interests: {} } }, ideas })).pick;
	assert.equal(pick.question.id, 'idea_stage');
	assert.equal(pick.entityId, 'b2', 'public ideas come before drafts');
	assert.equal(pick.entityLabel, 'Edge Vision');
});
