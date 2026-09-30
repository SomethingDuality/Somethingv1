// The internal API the Python agent calls (127.0.0.1:5051, service key). Node stays the owner of
// users and ideas: the agent reads them here and changes them only through applyUpdate with
// source 'agent', so provenance is recorded the same way as every other write.
const mongoose = require('mongoose');
const { BaseUser } = require('../models/user.model.js');
const { Idea } = require('../models/ideas.model.js');
const { IdeaUpdate } = require('../models/ideaUpdate.model.js');
const { FIELDS, FieldError } = require('../profile/fields.js');
const { applyUpdate } = require('../profile/applyUpdate.js');
const { pushNotification } = require('../services/notifications.service.js');

const isId = (v) => mongoose.isValidObjectId(v) && String(new mongoose.Types.ObjectId(String(v))) === String(v);
const get = (doc, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), doc);
const sourcesOf = (doc) => {
	const fs = doc?.fieldSources;
	if (!fs) return {};
	return fs instanceof Map ? Object.fromEntries(fs) : { ...fs };
};

// R10: pedigree never reaches a judge. For a review the agent gets what bears on the idea itself;
// names, bios, employers, schools, titles and social links stay out (they also invite bias
// against students and first-time founders, who are core users).
const REVIEW_USER_FIELDS = new Set(['location', 'skills', 'interests']);

const userFields = (user, purpose) => {
	const out = {};
	for (const [path, def] of Object.entries(FIELDS.user)) {
		if (def.roles && !def.roles.includes(user.role)) continue;
		if (purpose === 'review' && !REVIEW_USER_FIELDS.has(path)) continue;
		const v = get(user, path);
		if (v !== undefined) out[path] = v;
	}
	return out;
};

const ideaFields = (idea) => {
	const out = {};
	for (const path of Object.keys(FIELDS.idea)) {
		const v = get(idea, path);
		if (v !== undefined) out[path] = v;
	}
	return out;
};

// GET /internal/context/:userId?ideaId=&purpose=review|memory
async function context(req, res) {
	const { userId } = req.params;
	const { ideaId } = req.query;
	const purpose = req.query.purpose === 'memory' ? 'memory' : 'review';
	if (!isId(userId) || (ideaId && !isId(ideaId))) return res.status(404).json({ success: false });
	const user = await BaseUser.findById(userId).select('-password -refreshToken -notifications -email').lean();
	if (!user) return res.status(404).json({ success: false });
	const out = {
		user: {
			id: String(user._id),
			role: user.role,
			fields: userFields(user, purpose),
			fieldSources: purpose === 'memory' ? sourcesOf(user) : undefined,
		},
	};
	if (ideaId) {
		const idea = await Idea.findOne({ _id: ideaId, founder_id: userId }).lean();
		if (!idea) return res.status(404).json({ success: false });
		const updates = await IdeaUpdate.find({ idea_id: ideaId }).sort({ createdAt: -1 }).limit(10).select('text createdAt').lean();
		out.idea = {
			id: String(idea._id),
			fields: ideaFields(idea),
			fieldSources: sourcesOf(idea),
			updatedAt: idea.updatedAt,
			milestones: (idea.milestones || []).map((m) => ({ id: String(m._id), title: m.title, status: m.status, proof: m.proof || '', doneAt: m.doneAt || null })),
			updates: updates.map((u) => ({ id: String(u._id), text: u.text, at: u.createdAt })),
			// Names and types only: files never reach a model until the upload sanitizer exists.
			attachments: (idea.attachments || []).map((a) => ({ name: a.name, type: a.type })),
		};
	}
	return res.json(out);
}

// POST /internal/apply-update { userId, entity: user|idea, entityId?, patch, ref? }
async function applyUpdateRoute(req, res) {
	const { userId, entity = 'user', entityId, patch } = req.body || {};
	if (!isId(userId) || !['user', 'idea'].includes(entity) || (entity === 'idea' && !isId(entityId))) {
		return res.status(400).json({ success: false, message: 'bad target' });
	}
	const user = await BaseUser.findById(userId).select('role').lean();
	if (!user) return res.status(404).json({ success: false });
	try {
		const doc = await applyUpdate({ userId, role: user.role, entity, entityId, patch, source: 'agent' });
		if (!doc) return res.status(404).json({ success: false });
		return res.json({ ok: true, fields: Object.keys(patch) });
	} catch (err) {
		if (err instanceof FieldError) return res.status(422).json({ ok: false, field: err.path, message: err.message });
		throw err;
	}
}

// POST /internal/notify { userId, text, key, link? } — idempotent by key.
async function notify(req, res) {
	const { userId, text, key, link } = req.body || {};
	if (!isId(userId) || typeof text !== 'string' || !text.trim() || !key) {
		return res.status(400).json({ success: false, message: 'userId, text and key are required' });
	}
	await pushNotification(userId, text.trim().slice(0, 300), { key: `agent:${String(key).slice(0, 200)}`, link });
	return res.json({ ok: true });
}

// PUT /internal/questions/:confirmId — the agent asks the founder to confirm a memory change (R12).
// It shows in the Something box before any bank question. Re-sending the same confirm never
// re-opens one the founder already answered.
async function putQuestion(req, res) {
	const { QuestionState } = require('../models/questionState.model.js');
	const { confirmId } = req.params;
	const { userId, ideaId, prompt, slot, slotLabel, current, proposed, expiresAt } = req.body || {};
	if (!/^c[a-f0-9]{8,40}$/.test(confirmId) || !isId(userId) || (ideaId && !isId(ideaId)) || typeof prompt !== 'string' || !prompt.trim()) {
		return res.status(400).json({ success: false, message: 'bad confirm' });
	}
	await QuestionState.updateOne(
		{ userId, questionId: `agent:${confirmId}`, entityId: ideaId || null },
		{
			$set: { origin: 'agent', payload: { prompt: prompt.trim().slice(0, 300), slot, slotLabel, current, proposed }, expiresAt: expiresAt ? new Date(expiresAt) : undefined },
			$setOnInsert: { status: 'open' },
		},
		{ upsert: true },
	);
	return res.json({ ok: true });
}

// DELETE /internal/questions/:confirmId — withdrawn or expired.
async function deleteQuestion(req, res) {
	const { QuestionState } = require('../models/questionState.model.js');
	await QuestionState.deleteMany({ questionId: `agent:${req.params.confirmId}`, origin: 'agent' });
	return res.json({ ok: true });
}

// ---- Matching (interim matcher in the agent; Prapti's Brain later reads the same packets) ----
// Public data only: published, non-hidden ideas; no drafts, no moderation details, no emails,
// no pedigree (R10). Investors' Ghost Mode is untouched: nothing here is shown to founders.

// GET /internal/match/ideas — every public idea as a match packet.
async function matchIdeas(_req, res) {
	const { PUBLIC_IDEA } = require('../community/targets.js');
	const { Founder } = require('../models/user.model.js');
	const ideas = await Idea.find(PUBLIC_IDEA).select('title description tags stage raising lookingFor founder_id createdAt likes').sort({ createdAt: -1 }).limit(5000).lean();
	const founders = await Founder.find({ _id: { $in: [...new Set(ideas.map((i) => String(i.founder_id)))] } }).select('location').lean();
	const loc = new Map(founders.map((f) => [String(f._id), f.location || '']));
	return res.json({ ideas: ideas.map((i) => ({
		id: String(i._id), founderId: String(i.founder_id), title: i.title, description: String(i.description || '').slice(0, 1200),
		tags: i.tags || [], stage: i.stage || null, raising: i.raising || null, lookingFor: i.lookingFor || [],
		founderLocation: loc.get(String(i.founder_id)) || '', createdAt: i.createdAt, likes: i.likes || 0,
	})) });
}

// GET /internal/match/user/:userId — what the matcher may use about one person.
async function matchUser(req, res) {
	const { userId } = req.params;
	if (!isId(userId)) return res.status(404).json({ success: false });
	const user = await BaseUser.findById(userId).lean();
	if (!user) return res.status(404).json({ success: false });
	const known = Object.keys(sourcesOf(user)).map((k) => k.replace(/__/g, '.'));
	if (user.role === 'Investor') {
		const { Portfolio } = require('../models/portfolio.model.js');
		const p = await Portfolio.findOne({ investor_id: userId }).select('investments.idea_id').lean();
		return res.json({
			id: String(user._id), role: 'Investor', known,
			interests: user.interests || [], stageFocus: user.stageFocus || [],
			// Defaults (5,000–50,000) aren't answers: only checks the investor set count.
			minCheck: known.includes('minCheck') ? user.minCheck : null, maxCheck: known.includes('maxCheck') ? user.maxCheck : null,
			keywords: user.customMatchKeywords || [], thesis: String(user.bio || '').slice(0, 1200),
			saved: (user.watchlist || []).map(String), committed: (p?.investments || []).map((x) => String(x.idea_id)),
		});
	}
	const own = await Idea.find({ founder_id: userId }).select('_id').lean();
	return res.json({
		id: String(user._id), role: user.role, known,
		skills: user.skills || [], interests: user.interests || [], location: user.location || '',
		ownIdeas: own.map((i) => String(i._id)),
	});
}

// GET /internal/match/users?role=Investor|Founder&after=<id> — ids for the weekly batches, 500 at a time.
async function matchUsers(req, res) {
	const role = req.query.role === 'Founder' ? 'Founder' : 'Investor';
	const q = { role, ...(isId(req.query.after) && { _id: { $gt: new mongoose.Types.ObjectId(String(req.query.after)) } }) };
	const users = await BaseUser.find(q).select('_id').sort({ _id: 1 }).limit(500).lean();
	return res.json({ ids: users.map((u) => String(u._id)) });
}

async function health(_req, res) {
	return res.json({ status: mongoose.connection.readyState === 1 ? 'ok' : 'degraded' });
}

module.exports = { context, applyUpdateRoute, notify, health, putQuestion, deleteQuestion, matchIdeas, matchUser, matchUsers, REVIEW_USER_FIELDS };
