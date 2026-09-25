// Helpers over shared/taxonomy.json (synced here by `node shared/sync.mjs`).
// Mongo stores ids (e.g. "ai_ml"); the UI shows labels. Unknown values are kept as custom entries.
const taxonomy = require('./taxonomy.generated.json');

// Case-, spacing- and hyphen-insensitive key: "Local‑first" (U+2011), "local-first", "Local first" match.
const key = (v) => String(v).toLowerCase().normalize('NFKC')
	.replace(/[‐-―\-_/\s]+/g, ' ').trim();

const indexes = {};
for (const [kind, entries] of Object.entries(taxonomy)) {
	if (!Array.isArray(entries)) continue;
	const map = new Map();
	for (const e of entries) {
		map.set(key(e.id), e.id);
		map.set(key(e.label), e.id);
		for (const a of e.aliases || []) map.set(key(a), e.id);
	}
	indexes[kind] = map;
}

const list = (kind) => taxonomy[kind] || [];

const find = (kind, id) => list(kind).find((e) => e.id === id) || null;

/** Canonical id for a known value, or the trimmed input for a custom one; null for empty. */
const normalize = (kind, value) => {
	if (value === undefined || value === null) return null;
	const s = String(value).trim();
	if (!s) return null;
	return indexes[kind]?.get(key(s)) ?? s;
};

/** Normalizes, drops empties and duplicates, keeps order. */
const normalizeList = (kind, values) => {
	const out = [];
	for (const v of Array.isArray(values) ? values : []) {
		const n = normalize(kind, v);
		if (n && !out.includes(n)) out.push(n);
	}
	return out;
};

const isKnown = (kind, value) => Boolean(find(kind, value));

const labelFor = (kind, value) => find(kind, value)?.label ?? String(value);

module.exports = { taxonomy, list, find, normalize, normalizeList, isKnown, labelFor };
