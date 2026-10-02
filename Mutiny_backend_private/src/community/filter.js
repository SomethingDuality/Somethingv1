// Word filter for community text (C1). Whole words and whole phrases only, after undoing the
// usual tricks for slipping past a list: case, accents, leetspeak ("sh1t"), invisible format
// characters (zero-width, bidi), look-alike letters from other scripts ("fuсk" with a Cyrillic
// с), stretched letters ("fuuuck"), spaced-out letters ("f u c k"), letters split by punctuation
// ("f.u.ck", "chu-ti-ya"), words split in two ("mother fucker"), plurals and -ing/-er forms of
// words of 4+ letters, and phrases written as one word ("guaranteedreturns"). Single words never
// match inside other words, so "Scunthorpe" or "class" are safe.
// The lists live in shared/moderation.json (synced here by `node shared/sync.mjs`).

const lists = require('../shared/moderation.generated.json');

const INVISIBLE = /\p{Cf}/gu; // soft hyphen, zero-width and bidi controls, tag characters
// Letters from other scripts that look Latin (only for matching; the text itself is untouched).
const LOOKALIKE = {
	а: 'a', в: 'b', е: 'e', ё: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x',
	і: 'i', ї: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ԛ: 'q', ԝ: 'w',
	α: 'a', β: 'b', ε: 'e', η: 'n', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x',
};
const unLookalike = (s) => s.replace(/[\u0370-\u03ff\u0400-\u052f]/g, (ch) => LOOKALIKE[ch] || ch);
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i', '+': 't' };
const LETTER = /\p{L}/u;

// A chunk between spaces → letters only. With `leet`, leet characters count inside chunks that
// also hold a letter, so "100" stays a number while "sh1t" reads as "shit". Text is read both
// ways, so "RETURNS!!!" still reads as "returns".
// "!", "|" and "+" are mostly punctuation, so they read as letters only between two letters
// ("sh!t" yes, "wow!!" no).
const EDGY = new Set(['!', '|', '+']);
const letterish = (ch) => ch !== undefined && (LETTER.test(ch) || (LEET[ch] !== undefined && !EDGY.has(ch)));

const cleanChunk = (chunk, leet) => {
	const chars = [...chunk];
	const hasLetter = chars.some((ch) => LETTER.test(ch));
	let out = '';
	chars.forEach((ch, i) => {
		if (LETTER.test(ch)) out += ch;
		else if (leet && hasLetter && LEET[ch] && (!EDGY.has(ch) || (letterish(chars[i - 1]) && letterish(chars[i + 1])))) out += LEET[ch];
		else out += ' ';
	});
	return out;
};

const tokensOf = (text, { leet = false, joined = false } = {}) => {
	const base = unLookalike(String(text || '')
		.normalize('NFKD').replace(/\p{M}+/gu, '')
		.normalize('NFKC')
		.toLowerCase()
		.replace(INVISIBLE, ''));
	// `joined`: punctuation inside a chunk joins instead of splitting ("f.u.ck" → "fuck").
	const words = base.split(/\s+/).flatMap((c) => (joined ? cleanChunk(c, leet).replace(/\s+/g, '') : cleanChunk(c, leet)).split(/\s+/)).filter(Boolean);
	// A run of 3+ single letters ("f u c k") is also read as one word.
	const out = [];
	for (let i = 0; i < words.length;) {
		let j = i;
		while (j < words.length && words[j].length === 1) j++;
		if (j - i >= 3) { out.push(words.slice(i, j).join('')); i = j; continue; }
		out.push(words[i]);
		i++;
	}
	return out;
};

// Runs of 3+ of the same letter count as one ("fuuuck" → "fuck"); doubles are left alone, so
// "good" never turns into "god".
const squeeze = (w) => w.replace(/(\p{L})\1{2,}/gu, '$1');
// Plural and -ing/-er/-ed forms of an entry of 4+ letters ("fuckers", "fucking"); shorter entries
// only match exactly, so "assess" or "classes" can't read as a short word.
const SUFFIXES = ['s', 'es', 'er', 'ers', 'ing', 'in', 'ed', 'y'];
const same = (word, entry) => {
	const w = squeeze(word), e = squeeze(entry);
	if (word === entry || w === e) return true;
	return e.length >= 4 && SUFFIXES.some((x) => w === e + x);
};

const compile = (entries = []) => entries.map(tokensOf).filter((t) => t.length > 0);
const BLOCK  = compile(lists.block);
const REVIEW = compile(lists.review);
const ALLOW  = new Set((lists.allow || []).flatMap(tokensOf));

const findIn = (tokens, entries) => {
	const hits = [];
	for (const entry of entries) {
		let found = false;
		if (entry.length === 1) {
			found = tokens.some((t, i) => !ALLOW.has(t) && (
				same(t, entry[0]) || (i + 1 < tokens.length && same(t + tokens[i + 1], entry[0]))
			));
		} else {
			for (let i = 0; !found && i + entry.length <= tokens.length; i++) {
				found = entry.every((w, k) => same(tokens[i + k], w));
			}
			// A phrase written as one word, or spaced differently ("whats app me"): the phrase is
			// long and specific enough to look for without the spaces.
			const flat = entry.join('');
			if (!found && flat.length >= 8) found = tokens.join('').includes(flat);
		}
		if (found) hits.push(entry.join(' '));
	}
	return hits;
};

/** { verdict: 'ok' | 'review' | 'block', terms } for one or more pieces of text. */
const checkText = (...texts) => {
	const text = texts.filter(Boolean).join('\n');
	const readings = [tokensOf(text), tokensOf(text, { leet: true }), tokensOf(text, { joined: true }), tokensOf(text, { leet: true, joined: true })];
	const hits = (entries) => [...new Set(readings.flatMap((tokens) => findIn(tokens, entries)))];
	const block = hits(BLOCK);
	if (block.length) return { verdict: 'block', terms: block };
	const review = hits(REVIEW);
	if (review.length) return { verdict: 'review', terms: review };
	return { verdict: 'ok', terms: [] };
};

const BLOCKED = {
	success: false,
	code:    'BLOCKED_WORDS',
	message: "Some words here aren't allowed on Something. Please rephrase and try again.",
};

module.exports = { checkText, tokensOf, BLOCKED };
