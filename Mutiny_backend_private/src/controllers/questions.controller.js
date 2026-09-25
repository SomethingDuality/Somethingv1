const mongoose = require('mongoose');
const { BaseUser, Founder, Investor } = require('../models/user.model.js');
const { Idea } = require('../models/ideas.model.js');
const { QuestionState } = require('../models/questionState.model.js');
const { QuestionCadence } = require('../models/questionCadence.model.js');
const bank = require('../questions/bank.js');
const { selectNext, applySkip, applyAnswer, stateKey, isKnown } = require('../questions/selector.js');
const { validTimezone, localDay, nextLocalMidnight } = require('../questions/time.js');
const P = require('../questions/policy.js');
const { render } = require('../questions/render.js');
const { toPatch } = require('../questions/writers.js');
const { applyUpdate, FieldError } = require('../profile/applyUpdate.js');
const { emit } = require('../events/index.js');

const CONTEXTS = new Set(['more', ...Object.keys(bank.contexts)]);

// Schema defaults, so "minCheck: 5000" is recognised as a default rather than an answer.
const schemaDefaults = (Model, paths) => Object.fromEntries(paths.map((p) => {
	const d = Model.schema.path(p)?.defaultValue;
	return [p, typeof d === 'function' ? undefined : d];
}));
const DEFAULTS = {
	Founder:  { user: schemaDefaults(Founder, bank.questions.filter((q) => q.entity === 'user').flatMap((q) => q.fields)), idea: {} },
	Investor: { user: schemaDefaults(Investor, bank.questions.filter((q) => q.entity === 'user').flatMap((q) => q.fields)), idea: {} },
};

// Dev-only clock override so backoff can be tested across days in a browser.
const clock = (req) => {
	if (process.env.NODE_ENV !== 'production' && req.get('x-dev-now')) {
		const d = new Date(req.get('x-dev-now'));
		if (!Number.isNaN(d.getTime())) return d;
	}
	return new Date();
};

const loadContext = async (userId, role) => {
	const [user, ideas, states, cadence] = await Promise.all([
		BaseUser.findById(userId).lean(),
		role === 'Founder' ? Idea.find({ founder_id: userId }).select('title stage tags lookingFor isDraft createdAt fieldSources').lean() : [],
		QuestionState.find({ userId }).lean(),
		QuestionCadence.findOne({ userId }).lean(),
	]);
	const stateMap = new Map(states.map((s) => [stateKey(s.questionId, s.entityId), s]));
	return { user, ideas, states: stateMap, cadence: cadence || {} };
};

const getNext = async (req, res) => {
	const userId = req.user._id;
	const role = req.user.role;
	const now = clock(req);
	const context = req.query.context ? String(req.query.context) : undefined;
	if (context && !CONTEXTS.has(context)) return res.status(400).json({ success: false, message: 'Unknown context' });

	try {
		const tz = validTimezone(req.query.tz);
		if (tz) await QuestionCadence.updateOne({ userId }, { $set: { timezone: tz }, $setOnInsert: { userId } }, { upsert: true });

		const ctx = await loadContext(userId, role);
		const timezone = tz || ctx.cadence.timezone || 'UTC';
		const today = localDay(now, timezone);
		const result = selectNext({ questions: bank.questions, role, user: ctx.user, ideas: ctx.ideas, states: ctx.states,
			defaults: DEFAULTS[role] || {}, cadence: ctx.cadence, context, now, timezone });

		if (result.resolveDaily) {
			await QuestionCadence.updateOne({ userId }, { $set: { 'daily.resolved': true } });
		}

		if (result.claimDaily) {
			// Claim today's slot atomically: two tabs loading at once still get the same question.
			const claimed = await QuestionCadence.findOneAndUpdate(
				{ userId, 'daily.day': { $ne: today } },
				{ $set: { daily: { day: today, questionId: result.pick.question.id, entityId: result.pick.entityId, resolved: false } } },
				{ returnDocument: 'after' }
			);
			if (!claimed) {
				const again = await loadContext(userId, role);
				const retry = selectNext({ questions: bank.questions, role, user: again.user, ideas: again.ideas, states: again.states,
					defaults: DEFAULTS[role] || {}, cadence: again.cadence, now, timezone });
				if (!retry.pick) return res.json({ question: null, reason: retry.reason, nextEligibleAt: retry.nextEligibleAt ?? null });
				result.pick = retry.pick;
			}
		}

		if (!result.pick) return res.json({ question: null, reason: result.reason, nextEligibleAt: result.nextEligibleAt ?? null });

		const { question: q, entityId } = result.pick;
		await QuestionState.updateOne(
			{ userId, questionId: q.id, entityId: entityId || null },
			{ $inc: { shownCount: 1 }, $set: { lastShownAt: now, lastContext: context || 'daily' }, $setOnInsert: { firstShownAt: now } },
			{ upsert: true }
		);
		const cadenceUpdate = { $inc: { 'totals.shown': 1 } };
		if (result.reason === 'jit') {
			const sameDay = ctx.cadence.jit?.day === today;
			cadenceUpdate.$set = { 'jit.day': today, 'jit.count': (sameDay ? ctx.cadence.jit.count : 0) + 1 };
		}
		await QuestionCadence.updateOne({ userId }, { ...cadenceUpdate, $setOnInsert: { userId } }, { upsert: true });
		emit('question.shown', userId, { userId: String(userId), questionId: q.id, entityId, context: context || 'daily' });

		return res.json({ question: render(result.pick, result.reason, context) });
	} catch (err) {
		console.error('questions.next:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const findQuestion = (req, res) => {
	const q = bank.get(req.params.id);
	if (!q) { res.status(404).json({ success: false, message: 'Unknown question' }); return null; }
	if (!q.roles.includes(req.user.role)) { res.status(403).json({ success: false, message: 'Not your question' }); return null; }
	const entityId = req.body?.entityId || null;
	if (q.entity === 'idea' && !mongoose.Types.ObjectId.isValid(entityId)) {
		res.status(400).json({ success: false, message: 'entityId (idea) is required' });
		return null;
	}
	return { q, entityId: q.entity === 'idea' ? entityId : null };
};

const markDailyResolved = async (userId, q, entityId, now) => {
	const cadence = await QuestionCadence.findOne({ userId }).lean();
	const d = cadence?.daily;
	if (d && d.day === localDay(now, cadence.timezone || 'UTC') && d.questionId === q.id && String(d.entityId ?? '') === String(entityId ?? '')) {
		await QuestionCadence.updateOne({ userId }, { $set: { 'daily.resolved': true } });
	}
};

const answer = async (req, res) => {
	const found = findQuestion(req, res);
	if (!found) return;
	const { q, entityId } = found;
	const userId = req.user._id;
	const now = clock(req);
	const context = req.body?.context;

	try {
		const patch = toPatch(q, req.body?.value);
		const doc = await applyUpdate({ userId, role: req.user.role, entity: q.entity, entityId, patch, source: 'question' });
		if (!doc) return res.status(404).json({ success: false, message: q.entity === 'idea' ? 'Idea not found' : 'User not found' });

		await QuestionState.updateOne(
			{ userId, questionId: q.id, entityId },
			{ $set: { status: 'answered', answeredAt: now, answeredVia: 'box', snoozedUntil: null } },
			{ upsert: true }
		);
		await QuestionCadence.updateOne(
			{ userId },
			{ $set: applyAnswer(), $inc: { 'totals.answered': 1 }, $setOnInsert: { userId } },
			{ upsert: true }
		);
		await markDailyResolved(userId, q, entityId, now);
		emit('question.answered', userId, { userId: String(userId), questionId: q.id, entityId, fields: Object.keys(patch) });

		return res.json({ ok: true, saved: { entity: q.entity, entityId, fields: Object.keys(patch) } });
	} catch (err) {
		if (err instanceof FieldError) return res.status(422).json({ success: false, field: err.path, message: err.message });
		console.error('questions.answer:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const skip = async (req, res) => {
	const found = findQuestion(req, res);
	if (!found) return;
	const { q, entityId } = found;
	const mode = req.body?.mode;
	if (!['later', 'skip', 'never'].includes(mode)) return res.status(400).json({ success: false, message: 'mode must be later, skip or never' });
	const userId = req.user._id;
	const now = clock(req);

	try {
		const [state, cadence] = await Promise.all([
			QuestionState.findOne({ userId, questionId: q.id, entityId }).lean(),
			QuestionCadence.findOne({ userId }).lean(),
		]);
		const timezone = cadence?.timezone || 'UTC';
		const out = applySkip({ state: state || {}, cadence: cadence || {}, mode, now, timezone });

		await QuestionState.updateOne(
			{ userId, questionId: q.id, entityId },
			{ $set: { status: out.state.status, skipCount: out.state.skipCount || 0, laterCount: out.state.laterCount || 0,
				snoozedUntil: out.state.snoozedUntil ?? null, lastSkippedAt: out.state.lastSkippedAt ?? state?.lastSkippedAt } },
			{ upsert: true }
		);
		await QuestionCadence.updateOne(
			{ userId },
			{ $set: out.cadence, $inc: { [`totals.${mode === 'never' ? 'never' : 'skipped'}`]: 1 }, $setOnInsert: { userId } },
			{ upsert: true }
		);
		await markDailyResolved(userId, q, entityId, now);
		emit('question.skipped', userId, { userId: String(userId), questionId: q.id, entityId, mode });

		return res.json({ ok: true, status: out.state.status, snoozedUntil: out.state.snoozedUntil ?? null, pausedUntil: out.cadence.pausedUntil ?? null });
	} catch (err) {
		console.error('questions.skip:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

// How far along the user is, for the box's check-in: answered vs all the questions that apply to
// them (their profile, plus their most recent ideas), and the same per area (what each unlocks).
const progress = async (req, res) => {
	const userId = req.user._id;
	const role = req.user.role;
	try {
		const ctx = await loadContext(userId, role);
		const defaults = DEFAULTS[role] || {};
		const recentIdeas = [...ctx.ideas]
			.sort((a, b) => (a.isDraft === b.isDraft ? new Date(b.createdAt) - new Date(a.createdAt) : a.isDraft ? 1 : -1))
			.slice(0, P.IDEA_SCOPE_LIMIT);
		let answered = 0;
		let total = 0;
		const areas = new Map();
		for (const q of bank.questions) {
			if (!q.roles.includes(role)) continue;
			const targets = q.entity === 'idea' ? recentIdeas.map((i) => ({ id: String(i._id), doc: i })) : [{ id: null, doc: ctx.user }];
			for (const t of targets) {
				const st = ctx.states.get(stateKey(q.id, t.id));
				if (st?.status === 'never') continue; // the user said no; it no longer counts against them
				const done = isKnown(t.doc, q.fields[0], defaults[q.entity]?.[q.fields[0]]) || st?.status === 'answered';
				total += 1;
				if (done) answered += 1;
				for (const c of q.unlocks || []) {
					const a = areas.get(c) || { id: c, label: bank.contexts[c]?.label || c, answered: 0, total: 0 };
					a.total += 1;
					if (done) a.answered += 1;
					areas.set(c, a);
				}
			}
		}
		return res.json({ answered, total, areas: [...areas.values()].sort((a, b) => (b.answered / b.total) - (a.answered / a.total)) });
	} catch (err) {
		console.error('questions.progress:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

// "Take a break": no unprompted question until tomorrow (the user's local midnight). Asking for
// one still works ("more" ignores the pause).
const rest = async (req, res) => {
	const userId = req.user._id;
	const now = clock(req);
	try {
		const cadence = await QuestionCadence.findOne({ userId }).lean();
		const until = nextLocalMidnight(now, cadence?.timezone || 'UTC');
		await QuestionCadence.updateOne(
			{ userId },
			{ $set: { pausedUntil: until, consecutiveSkips: 0 }, $setOnInsert: { userId } },
			{ upsert: true },
		);
		emit('question.rest', userId, { userId: String(userId), until });
		return res.json({ ok: true, pausedUntil: until });
	} catch (err) {
		console.error('questions.rest:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

module.exports = { getNext, answer, skip, progress, rest };
