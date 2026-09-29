const { test } = require('node:test');
const assert = require('node:assert/strict');
const { serializeThread, visibleUserIds } = require('../../src/chat/serialize.js');

const founder = '64b000000000000000000001';
const investor = '64b000000000000000000002';
const thread = (over = {}) => ({
	_id: 't1',
	kind: 'founder_investor',
	status: 'active',
	requestedBy: investor,
	recipientId: founder,
	context: { ideaId: 'i1', ideaTitle: 'Campus compost' },
	participants: [
		{ userId: investor, role: 'Investor', ghost: true, revealedAt: null, hint: { stageFocus: ['seed'] }, unread: 0 },
		{ userId: founder, role: 'Founder', ghost: false, unread: 2 },
	],
	lastMessageText: 'Hello',
	lastMessageAt: new Date(),
	lastMessageBy: investor,
	...over,
});

test('an unrevealed ghost is never looked up, so nothing about them can reach the founder', () => {
	// Even if the name map had the investor (it never should), the founder's view doesn't use it.
	const people = new Map([[investor, { name: 'Zed Quill7Q', firm: 'Quillstone Capital' }]]);
	const out = serializeThread(thread(), founder, people);
	assert.deepEqual(out.other, { name: 'Ghost investor', role: 'Investor', ghost: true, hint: 'Invests at Seed' });
	const json = JSON.stringify(out);
	for (const leak of ['Zed', 'Quill7Q', 'Quillstone', investor]) assert.ok(!json.includes(leak), leak);
	assert.deepEqual(visibleUserIds([thread()], founder), []);
	assert.equal(out.unread, 2);
});

test('once revealed, the founder sees the name; the investor always sees the founder', () => {
	const people = new Map([[investor, { name: 'Zed Quill7Q', firm: 'Quillstone Capital' }], [founder, { name: 'Fay' }]]);
	const revealed = thread({ participants: thread().participants.map((p) => (p.role === 'Investor' ? { ...p, revealedAt: new Date() } : p)) });
	assert.deepEqual(serializeThread(revealed, founder, people).other, { name: 'Zed Quill7Q', role: 'Investor', ghost: false, firm: 'Quillstone Capital' });
	const mine = serializeThread(thread(), investor, people);
	assert.equal(mine.other.name, 'Fay');
	assert.deepEqual(mine.me, { ghost: true, canReveal: true });
	assert.equal(mine.lastMessage.mine, true);
});

test('who may send, and what a quiet decline looks like from each side', () => {
	const people = new Map();
	const req = thread({ status: 'request' });
	assert.equal(serializeThread(req, founder, people).status, 'request_in');
	assert.equal(serializeThread(req, founder, people).canSend, true);
	const out = serializeThread(req, investor, people);
	assert.equal(out.status, 'request_out');
	assert.equal(out.canSend, false);
	const declined = thread({ status: 'declined' });
	assert.equal(serializeThread(declined, investor, people).reason, 'No reply. You can ask again later.');
	assert.equal(serializeThread(declined, founder, people).reason, 'You declined this request.');
});
