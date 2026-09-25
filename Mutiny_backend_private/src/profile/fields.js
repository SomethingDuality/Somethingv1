// Registry of every field a user can edit, with how to validate and normalize it.
// Profile forms, the Something box and (later) the agent service all write through
// applyUpdate(), which uses this table — there is one write path, so values stay consistent.
const tax = require('../shared/taxonomy.js');

class FieldError extends Error {
	constructor(path, message) {
		super(`${path}: ${message}`);
		this.path = path;
		this.status = 422;
	}
}

const text = (max) => (v, path) => {
	if (v === null) return '';
	if (typeof v !== 'string') throw new FieldError(path, 'must be text');
	const s = v.trim();
	if (s.length > max) throw new FieldError(path, `must be at most ${max} characters`);
	return s;
};

const url = (hosts) => (v, path) => {
	const s = text(300)(v, path);
	if (!s) return '';
	let u;
	try { u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { throw new FieldError(path, 'must be a link'); }
	if (!/^https?:$/.test(u.protocol)) throw new FieldError(path, 'must be an http(s) link');
	if (hosts && !hosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) {
		throw new FieldError(path, `must be a ${hosts[0]} link`);
	}
	return u.toString();
};

const handle = (v, path) => text(60)(v, path).replace(/^@+/, '');

const oneOf = (values) => (v, path) => {
	if (v === null || v === '') return '';
	if (!values.includes(v)) throw new FieldError(path, `must be one of ${values.join(', ')}`);
	return v;
};

const taxOne = (kind) => (v, path) => {
	const id = tax.normalize(kind, v);
	if (id === null) return '';
	if (!tax.isKnown(kind, id)) throw new FieldError(path, `unknown ${kind} value "${v}"`);
	return id;
};

const taxList = (kind, { max = 10, custom = true } = {}) => (v, path) => {
	if (v === null) return [];
	if (!Array.isArray(v)) throw new FieldError(path, 'must be a list');
	const ids = tax.normalizeList(kind, v).map((id) => (tax.isKnown(kind, id) ? id : id.slice(0, 40)));
	if (!custom && ids.some((id) => !tax.isKnown(kind, id))) throw new FieldError(path, `only known ${kind} values are allowed`);
	if (ids.length > max) throw new FieldError(path, `at most ${max} items`);
	return ids;
};

const strList = (max, itemMax = 60) => (v, path) => {
	if (v === null) return [];
	if (!Array.isArray(v)) throw new FieldError(path, 'must be a list');
	const out = [];
	for (const item of v) {
		const s = String(item ?? '').trim().slice(0, itemMax);
		if (s && !out.includes(s)) out.push(s);
	}
	if (out.length > max) throw new FieldError(path, `at most ${max} items`);
	return out;
};

const number = (min, max) => (v, path) => {
	const n = Number(v);
	if (!Number.isFinite(n) || n < min || n > max) throw new FieldError(path, `must be a number between ${min} and ${max}`);
	return n;
};

const bool = (v) => Boolean(v);

const entries = (required, optional, max = 20) => (v, path) => {
	if (v === null) return [];
	if (!Array.isArray(v)) throw new FieldError(path, 'must be a list');
	if (v.length > max) throw new FieldError(path, `at most ${max} entries`);
	return v.map((item, i) => {
		const out = {};
		for (const k of required) {
			const s = typeof item?.[k] === 'string' ? item[k].trim() : '';
			if (!s) throw new FieldError(`${path}[${i}].${k}`, 'is required');
			out[k] = s.slice(0, 200);
		}
		for (const k of optional) out[k] = typeof item?.[k] === 'string' ? item[k].trim().slice(0, 1000) : '';
		return out;
	});
};

const notesList = (v, path) => {
	if (v === null) return [];
	if (!Array.isArray(v)) throw new FieldError(path, 'must be a list');
	return v.slice(0, 100).map((n) => ({
		content: text(2000)(n?.content ?? '', path),
		...(n?.createdAt && { createdAt: String(n.createdAt).slice(0, 40) }),
	})).filter((n) => n.content);
};

const PREF = oneOf(['yes', 'maybe', 'no']);

// sensitivity 'high' marks facts a later agent must confirm with the user before changing.
const FIELDS = {
	user: {
		name:      { roles: ['Founder', 'Investor'], set: (v, p) => { const s = text(100)(v, p); if (!s) throw new FieldError(p, 'is required'); return s; } },

		headline:           { roles: ['Founder'], set: text(120) },
		location:           { roles: ['Founder'], set: text(80), sensitivity: 'high' },
		about:              { roles: ['Founder'], set: text(2000) },
		'socials.linkedin': { roles: ['Founder'], set: url(['linkedin.com']) },
		'socials.twitter':  { roles: ['Founder'], set: handle },
		'socials.website':  { roles: ['Founder'], set: url() },
		'socials.github':   { roles: ['Founder'], set: url(['github.com']) },
		skills:             { roles: ['Founder'], set: taxList('skills', { max: 12 }) },
		interests:          { roles: ['Founder', 'Investor'], set: taxList('sectors', { max: 8 }) },
		experience_level:   { roles: ['Founder'], set: oneOf(['junior', 'mid', 'senior', 'founder', 'executive']) },
		occupation:         { roles: ['Founder'], set: oneOf(['software_engineer', 'product_manager', 'designer', 'business_owner', 'student', 'other']) },
		work_experience:    { roles: ['Founder'], set: entries(['role', 'company'], ['duration', 'description']) },
		education:          { roles: ['Founder'], set: entries(['institution', 'degree'], ['duration']) },

		firm:                   { roles: ['Investor'], set: text(120) },
		bio:                    { roles: ['Investor'], set: text(2000) },
		twitter:                { roles: ['Investor'], set: handle },
		linkedin:               { roles: ['Investor'], set: url(['linkedin.com']) },
		minCheck:               { roles: ['Investor'], set: number(0, 1e9) },
		maxCheck:               { roles: ['Investor'], set: number(0, 1e9) },
		totalCapitalPool:       { roles: ['Investor'], set: number(0, 1e11) },
		stageFocus:             { roles: ['Investor'], set: taxList('fundingStages', { max: 7, custom: false }) },
		escrowPreference:       { roles: ['Investor'], set: PREF },
		ndaPreference:          { roles: ['Investor'], set: PREF },
		openSourcePreference:   { roles: ['Investor'], set: PREF },
		hardwarePreference:     { roles: ['Investor'], set: PREF },
		cryptographyPreference: { roles: ['Investor'], set: PREF },
		pacePerQuarter:         { roles: ['Investor'], set: number(0, 100) },
		leadStatus:             { roles: ['Investor'], set: oneOf(['lead', 'follow', 'both']) },
		legalStructures:        { roles: ['Investor'], set: taxList('legalStructures', { max: 8 }), sensitivity: 'high' },
		vehicles:               { roles: ['Investor'], set: taxList('vehicles', { max: 4 }) },
		superpowers:            { roles: ['Investor'], set: taxList('superpowers', { max: 6 }) },
		customMatchKeywords:    { roles: ['Investor'], set: strList(20) },
		coInvestors:            { roles: ['Investor'], set: strList(20, 100) },
		notes:                  { roles: ['Investor'], set: notesList },
		publicProfile:          { roles: ['Investor'], set: bool },
		handle:                 { roles: ['Investor'], set: handle },
	},
	idea: {
		title:       { set: (v, p) => { const s = text(80)(v, p); if (!s) throw new FieldError(p, 'is required'); return s; } },
		description: { set: (v, p) => { const s = text(5000)(v, p); if (!s) throw new FieldError(p, 'is required'); return s; } },
		stage:       { set: taxOne('ideaStages'), sensitivity: 'high' },
		tags:        { set: taxList('sectors', { max: 5 }) },
		lookingFor:  { set: taxList('roles', { max: 8 }) },
		raising:     { set: taxOne('raisingBands') },
		isDraft:     { set: bool },
	},
};

// Mongo map keys can't contain '.', so "socials.github" is stored as "socials__github".
const sourceKey = (path) => path.replace(/\./g, '__');

// Only a real value counts as an answer. An empty string or list (e.g. a form sending stage: "")
// must not mark the field as known, or the Something box would never ask for it.
const isAnswered = (value) => {
	if (value === null || value === undefined) return false;
	if (typeof value === 'string') return value.trim() !== '';
	if (Array.isArray(value)) return value.length > 0;
	return true;
};

module.exports = { FIELDS, FieldError, sourceKey, isAnswered };
