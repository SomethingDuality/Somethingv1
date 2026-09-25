// Turns a Something box answer into a field patch. The patch is then validated and normalized
// by profile/fields.js through applyUpdate, like any other edit.
const tax = require('../shared/taxonomy.js');
const { optionsFor } = require('./bank.js');
const { FieldError } = require('../profile/fields.js');

const toPatch = (q, value) => {
	const field = q.fields[0];
	const opts = optionsFor(q);
	const allowed = new Set((opts || []).map((o) => o.value));

	if (q.type === 'chips') {
		const list = (Array.isArray(value) ? value : [value]).map((v) => String(v ?? '').trim()).filter(Boolean);
		const { min = 1, max = 1 } = q.select || {};
		if (list.length < min || list.length > max) throw new FieldError(q.id, `choose ${min === max ? min : `${min}–${max}`}`);
		if (!q.allowCustom && list.some((v) => !allowed.has(v))) throw new FieldError(q.id, 'not one of the options');

		if (q.writer === 'checkSize') {
			const bucket = tax.find('checkSizes', list[0]);
			return { minCheck: bucket.min, maxCheck: bucket.max };
		}
		if (q.writer === 'pace') return { pacePerQuarter: tax.find('paceBuckets', list[0]).value };
		// max 1 → a single value field (stage, occupation, leadStatus); otherwise a list field.
		return { [field]: max === 1 ? list[0] : list };
	}

	if (q.type === 'yes_no') {
		if (!allowed.has(value)) throw new FieldError(q.id, 'answer yes, no' + (q.allowMaybe ? ' or depends' : ''));
		return { [field]: value };
	}

	// text
	if (typeof value !== 'string' || !value.trim()) throw new FieldError(q.id, 'type an answer, or skip');
	if (q.maxLength && value.trim().length > q.maxLength) throw new FieldError(q.id, `at most ${q.maxLength} characters`);
	return { [field]: value.trim() };
};

module.exports = { toPatch };
