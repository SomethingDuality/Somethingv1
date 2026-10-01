// Word filter for community text (C1). Whole words and whole phrases only, after undoing the
// usual tricks for slipping past a list: case, accents, leetspeak ("sh1t"), zero-width
// characters, stretched letters ("fuuuck"), spaced-out letters ("f u c k") and words split in
// two ("mother fucker"). Substrings never match, so "Scunthorpe" or "class" are safe.
// The lists live in shared/moderation.json (synced here by `node shared/sync.mjs`).

const lists = require('../shared/moderation.generated.json');

const ZERO_WIDTH = /[­​-‏‪-‮⁠-⁤﻿]/g;
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

const tokensOf = (text, { leet = false } = {}) => {
	const base = String(text || '')
		.normalize('NFKD').replace(/\p{M}+/gu, '')
		.normalize('NFKC')
		.toLowerCase()
		.replace(ZERO_WIDTH, '');
	const words = base.split(/\s+/).flatMap((c) => cleanChunk(c, leet).split(/\s+/)).filter(Boolean);
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
const same = (word, entry) => word === entry || squeeze(word) === squeeze(entry);

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
		}
		if (found) hits.push(entry.join(' '));
	}
	return hits;
};

/** { verdict: 'ok' | 'review' | 'block', terms } for one or more pieces of text. */
const checkText = (...texts) => {
	const text = texts.filter(Boolean).join('\n');
	const readings = [tokensOf(text), tokensOf(text, { leet: true })];
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
