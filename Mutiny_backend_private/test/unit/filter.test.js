const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkText } = require('../../src/community/filter.js');

const verdict = (...t) => checkText(...t).verdict;

test('clean text passes, including words that contain a listed word', () => {
	assert.equal(verdict('Cheap vision kits for farms'), 'ok');
	assert.equal(verdict('Scunthorpe class assessment'), 'ok'); // no substring matches
	assert.equal(verdict('a+b testing for 100 users', '₹100 send'), 'ok');
	assert.equal(verdict('good god, wow!! great idea'), 'ok'); // doubles and "!!" stay as they are
});

test('blocked words are found through the usual disguises', () => {
	for (const t of ['fuck this', 'FUCK', 'fuuuuck', 'f u c k', 'f​uck', 'mother fucker', 'chut1ya', 'Bh3nch0d!!', 'ch00tiya']) {
		assert.equal(verdict(t), 'block', t);
	}
});

test('review phrases are found across case, spacing and punctuation', () => {
	assert.deepEqual(checkText('GUARANTEED   RETURNS!!!'), { verdict: 'review', terms: ['guaranteed returns'] });
	assert.equal(verdict('Café idiót'), 'review'); // accents
	assert.equal(verdict('fuck', 'guaranteed returns'), 'block'); // block wins
});
