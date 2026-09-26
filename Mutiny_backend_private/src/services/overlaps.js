// Finds ideas already on Something that look like a given one. Plain word overlap plus shared
// sectors: no AI, nothing stored, and only public ideas (never drafts) are compared.

const STOP = new Set(('the and for with that this from your you are our was were will can not but all any its into than then them they their there what when where which who why how about after also been being both each few more most other some such only own same very just over under again once here off out per via app apps platform startup idea ideas users user people make makes making using use used get gets like').split(' '));

const tokens = (text) => {
	const out = new Set();
	for (const raw of String(text || '').toLowerCase().normalize('NFKC').split(/[^a-z0-9ऀ-ॿ]+/)) {
		if (raw.length < 3 || STOP.has(raw)) continue;
		out.add(raw.length > 4 && raw.endsWith('s') ? raw.slice(0, -1) : raw);
	}
	return out;
};

/**
 * @param {{ text: string, sectors?: string[] }} source
 * @param {Array<{ _id, title, description, tags?: string[] }>} candidates
 * @returns the closest few with why they matched
 */
const findOverlaps = (source, candidates, { limit = 5 } = {}) => {
	const a = tokens(source.text);
	const sectors = new Set(source.sectors || []);
	if (a.size === 0 && sectors.size === 0) return [];
	const scored = [];
	for (const c of candidates) {
		const b = tokens(`${c.title} ${c.description}`);
		const shared = [...a].filter((w) => b.has(w));
		const sharedSectors = (c.tags || []).filter((t) => sectors.has(t));
		const words = a.size && b.size ? shared.length / Math.sqrt(a.size * b.size) : 0;
		const score = words + 0.12 * sharedSectors.length;
		if (shared.length >= 2 && score >= 0.12 || (sharedSectors.length && shared.length >= 1)) {
			scored.push({ idea: c, score, sharedWords: shared.sort((x, y) => y.length - x.length).slice(0, 5), sharedSectors });
		}
	}
	return scored.sort((x, y) => y.score - x.score).slice(0, limit);
};

module.exports = { findOverlaps, tokens };
