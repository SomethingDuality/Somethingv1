// Pure question selection and skip/answer transitions for the Something box. No I/O here,
// so the rules are unit-tested directly (test/unit/selector.test.js).
const P = require('./policy.js');
const { localDay, nextLocalMidnight, addDays } = require('./time.js');

const stateKey = (questionId, entityId) => `${questionId}:${entityId ? String(entityId) : ''}`;

const get = (doc, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), doc);
const hasSource = (doc, path) => {
	const fs = doc?.fieldSources;
	const k = path.replace(/\./g, '__');
	return Boolean(fs && (fs instanceof Map ? fs.get(k) : fs[k]));
};
const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * A field counts as known when the user set it (fieldSources), or when it holds a real value
 * that differs from the schema default. A default (minCheck 5000, escrowPreference "yes") is not an answer.
 */
const isKnown = (doc, path, defaultValue) => {
	if (hasSource(doc, path)) return true;
	const v = get(doc, path);
	if (isEmpty(v)) return false;
	return defaultValue === undefined || JSON.stringify(v) !== JSON.stringify(defaultValue);
};

/** Every (question, target) pair the user could be asked right now, best first. */
function eligible({ questions, role, user, ideas = [], states, defaults = {}, now }) {
	const out = [];
	const recentIdeas = [...ideas]
		.sort((a, b) => (a.isDraft === b.isDraft ? new Date(b.createdAt) - new Date(a.createdAt) : a.isDraft ? 1 : -1))
		.slice(0, P.IDEA_SCOPE_LIMIT);

	questions.forEach((q, bankIndex) => {
		if (!q.roles.includes(role)) return;
		const targets = q.entity === 'idea'
			? recentIdeas.map((idea, i) => ({ entityId: String(idea._id), doc: idea, title: idea.title, order: i }))
			: [{ entityId: null, doc: user, order: 0 }];
		for (const t of targets) {
			const field = q.fields[0];
			if (isKnown(t.doc, field, defaults[q.entity]?.[field])) continue;
			const st = states.get(stateKey(q.id, t.entityId));
			if (st && (st.status === 'answered' || st.status === 'never')) continue;
			if (st?.snoozedUntil && new Date(st.snoozedUntil) > now) continue;
			out.push({ question: q, entityId: t.entityId, entityLabel: t.title, skipCount: st?.skipCount ?? 0, bankIndex, order: t.order });
		}
	});

	return out.sort((a, b) =>
		(b.question.priority - a.question.priority) || (a.skipCount - b.skipCount) || (a.bankIndex - b.bankIndex) || (a.order - b.order));
}

/**
 * Decide what to show.
 *  context undefined → the daily question (at most one per local day, the same one on reload)
 *  context "more"    → the next eligible question ("Ask me another"), no cadence effect
 *  context <feature> → a just-in-time question that unlocks that feature (small daily cap)
 * Returns { pick, reason, claimDaily?, resolveDaily?, nextEligibleAt? }.
 */
function selectNext({ context, cadence = {}, now, timezone = 'UTC', ...rest }) {
	const today = localDay(now, timezone);
	const paused = cadence.pausedUntil && new Date(cadence.pausedUntil) > now;
	const candidates = eligible({ now, ...rest });

	if (!context) {
		if (paused) return { pick: null, reason: 'paused', nextEligibleAt: new Date(cadence.pausedUntil) };
		const d = cadence.daily || {};
		if (d.day === today) {
			if (d.resolved) return { pick: null, reason: 'done_today', nextEligibleAt: nextLocalMidnight(now, timezone) };
			const same = candidates.find((c) => c.question.id === d.questionId && String(c.entityId ?? '') === String(d.entityId ?? ''));
			if (same) return { pick: same, reason: 'daily' };
			return { pick: null, reason: 'done_today', resolveDaily: true, nextEligibleAt: nextLocalMidnight(now, timezone) };
		}
		const pick = candidates[0] || null;
		return pick ? { pick, reason: 'daily', claimDaily: true } : { pick: null, reason: 'nothing_left' };
	}

	if (context === 'more') {
		const d = cadence.daily || {};
		const skipDaily = d.day === today && !d.resolved;
		const pick = candidates.find((c) => !(skipDaily && c.question.id === d.questionId && String(c.entityId ?? '') === String(d.entityId ?? ''))) || null;
		return pick ? { pick, reason: 'more' } : { pick: null, reason: 'nothing_left' };
	}

	const cap = paused ? P.JIT_PAUSED_CAP : P.JIT_DAILY_CAP;
	const used = cadence.jit?.day === today ? cadence.jit.count : 0;
	if (used >= cap) return { pick: null, reason: 'jit_cap' };
	const pick = candidates.find((c) => (c.question.unlocks || []).includes(context)) || null;
	return pick ? { pick, reason: 'jit' } : { pick: null, reason: 'nothing_left' };
}

/** State and cadence changes for a skip. mode: later ("Not now") | skip | never ("Don't ask again"). */
function applySkip({ state = {}, cadence = {}, mode, now, timezone = 'UTC', isDaily }) {
	const s = { ...state };
	const c = { consecutiveSkips: cadence.consecutiveSkips || 0, pausedUntil: cadence.pausedUntil || null };

	if (mode === 'later') {
		s.status = 'snoozed';
		s.laterCount = (s.laterCount || 0) + 1;
		s.snoozedUntil = nextLocalMidnight(now, timezone);
	} else if (mode === 'skip' || mode === 'never') {
		s.skipCount = (s.skipCount || 0) + (mode === 'skip' ? 1 : 0);
		s.lastSkippedAt = now;
		if (mode === 'never' || s.skipCount >= P.NEVER_AFTER_SKIPS) {
			s.status = 'never';
			s.snoozedUntil = null;
		} else {
			s.status = 'skipped';
			s.snoozedUntil = addDays(now, Math.min(P.SKIP_SNOOZE_DAYS * 2 ** (s.skipCount - 1), P.SKIP_SNOOZE_MAX_DAYS));
		}
		c.consecutiveSkips += 1;
		if (c.consecutiveSkips >= P.PAUSE_AFTER_CONSECUTIVE) {
			const days = Math.min(P.PAUSE_DAYS * 2 ** (c.consecutiveSkips - P.PAUSE_AFTER_CONSECUTIVE), P.PAUSE_MAX_DAYS);
			c.pausedUntil = addDays(now, days);
		}
	} else {
		throw new Error(`unknown skip mode ${mode}`);
	}
	return { state: s, cadence: c, resolveDaily: Boolean(isDaily) };
}

/** An answer resets the skip streak and lifts any pause. */
const applyAnswer = () => ({ consecutiveSkips: 0, pausedUntil: null });

module.exports = { selectNext, eligible, applySkip, applyAnswer, isKnown, stateKey };
