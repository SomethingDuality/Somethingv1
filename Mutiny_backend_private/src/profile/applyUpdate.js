const { FIELDS, FieldError, sourceKey, isAnswered } = require('./fields.js');
const { BaseUser, Founder, Investor } = require('../models/user.model.js');
const { Idea } = require('../models/ideas.model.js');
const cache = require('../utils/cache.js');
const { emit } = require('../events/index.js');
const { checkText } = require('../community/filter.js');

const SOURCES = ['signup', 'profile', 'settings', 'question', 'google', 'legacy', 'agent'];
const PUBLIC_TEXT = new Set(['name', 'headline', 'about', 'firm', 'bio', 'location', 'title', 'description']);

/**
 * The one write path for user-editable fields.
 *  - validates and normalizes every key through profile/fields.js (unknown keys → 422)
 *  - records where each value came from in fieldSources.<key> = { source, at }
 *  - invalidates caches and emits profile.updated / idea.updated
 * Returns the updated document (lean).
 */
async function applyUpdate({ userId, role, entity = 'user', entityId, patch, source }) {
	if (!SOURCES.includes(source)) throw new Error(`unknown source ${source}`);
	const registry = FIELDS[entity];
	if (!registry) throw new Error(`unknown entity ${entity}`);
	if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new FieldError('body', 'must be an object');

	const $set = {};
	const $unset = {};
	const at = new Date();
	for (const [path, raw] of Object.entries(patch)) {
		// Own keys only: "constructor" or "__proto__" must be unknown fields, not a crash.
		const def = Object.hasOwn(registry, path) ? registry[path] : null;
		if (!def || (def.roles && !def.roles.includes(role))) throw new FieldError(path, 'is not an editable field');
		const value = def.set(raw, path);
		// Text other people read goes through the word filter, whoever writes it (a profile form,
		// the Something box, or the agent renaming an idea from the chat).
		if (PUBLIC_TEXT.has(path) && typeof value === 'string' && checkText(value).verdict === 'block') {
			throw new FieldError(path, "has words that aren't allowed on Something");
		}
		$set[path] = value;
		// Clearing a field forgets where it came from, so the Something box may ask again.
		if (isAnswered(value)) $set[`fieldSources.${sourceKey(path)}`] = { source, at };
		else $unset[`fieldSources.${sourceKey(path)}`] = '';
	}
	if (Object.keys($set).length === 0) throw new FieldError('body', 'no fields to update');
	const update = Object.keys($unset).length ? { $set, $unset } : { $set };

	if (entity === 'user') {
		const Model = role === 'Founder' ? Founder : role === 'Investor' ? Investor : BaseUser;
		if ('minCheck' in patch || 'maxCheck' in patch) {
			const current = await Model.findById(userId).select('minCheck maxCheck').lean();
			const min = $set.minCheck ?? current?.minCheck;
			const max = $set.maxCheck ?? current?.maxCheck;
			if (min != null && max != null && min > max) throw new FieldError('minCheck', 'must not exceed maxCheck');
		}
		const doc = await Model.findByIdAndUpdate(userId, update, { returnDocument: 'after', runValidators: true }).lean();
		if (!doc) return null;
		emit('profile.updated', userId, { userId: String(userId), fields: Object.keys(patch), source });
		return doc;
	}

	const doc = await Idea.findOneAndUpdate(
		{ _id: entityId, founder_id: userId },
		update,
		{ returnDocument: 'after', runValidators: true }
	).lean();
	if (!doc) return null;
	await cache.del(`user_ideas:${userId}`);
	emit('idea.updated', entityId, { ideaId: String(entityId), founderId: String(userId), changes: patch, source });
	return doc;
}

/** True when the user has given this field a value (or explicitly set it) — used by the Something box. */
function isKnown(doc, path, schema) {
	if (doc?.fieldSources && (doc.fieldSources[sourceKey(path)] || doc.fieldSources.get?.(sourceKey(path)))) return true;
	const def = schema?.path(path);
	if (def?.defaultValue !== undefined && def?.options?.default !== undefined) return false; // a default isn't an answer
	const value = path.split('.').reduce((o, k) => (o == null ? o : o[k]), doc);
	if (Array.isArray(value)) return value.length > 0;
	return value !== undefined && value !== null && value !== '';
}

module.exports = { applyUpdate, isKnown, FieldError };
