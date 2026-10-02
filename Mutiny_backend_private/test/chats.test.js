// Community C5: chats, request rules and Ghost Mode enforced on the server.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, resetDb, agent, verifyEmail, settle } = require('./helpers/server.js');

let Thread, Message, Idea, BaseUser;

before(async () => {
	await start();
	({ Thread }   = require('../src/models/thread.model.js'));
	({ Message }  = require('../src/models/message.model.js'));
	({ Idea }     = require('../src/models/ideas.model.js'));
	({ BaseUser } = require('../src/models/user.model.js'));
	await Thread.init();
	await Message.init();
});
after(stop);
beforeEach(resetDb);

const newUser = async (role, name, email) => {
	const a = agent();
	a.email = email || `${name.toLowerCase().replace(/\s+/g, '')}@example.test`;
	const res = await a.post('/auth/signup', { name, email: a.email, password: 'long enough pw', role, accepted_terms: true });
	assert.equal(res.status, 201, JSON.stringify(res.body));
	a.id = res.body.user._id;
	return a;
};
const newIdea = async (founder, title = 'Campus compost') => {
	const res = await founder.post('/ideas', { title, description: `${title}, in a sentence` });
	assert.equal(res.status, 201, JSON.stringify(res.body));
	return res.body._id;
};
const begin = async (from, ideaId, text = 'Hi, could we talk about this?', extra = {}) => {
	const res = await from.post('/threads', { ideaId, text, ...extra });
	assert.ok([200, 201].includes(res.status), JSON.stringify(res.body));
	return res.body.thread;
};
const ghostOff = async (inv) => assert.equal((await inv.put('/investor/ghost-mode', { on: false })).status, 200);

test('a ghost investor stays nameless to the founder in every response', async () => {
	const zed = await newUser('investor', 'Zed Quill7Q', 'zq7@example.test');
	await zed.put('/investor/profile', { firm: 'Quillstone Capital' });
	await zed.put('/investor/preferences', { stageFocus: ['seed'] });
	assert.equal((await zed.get('/auth/me')).body.ghostMode, true); // on by default

	const fay = await newUser('founder', 'Fay');
	const ideaId = await newIdea(fay);
	const t = await begin(zed, ideaId);
	await settle();

	const responses = [];
	const keep = async (p) => { const r = await p; responses.push(r.body); return r; };
	const list = await keep(fay.get('/threads'));
	assert.deepEqual(list.body.threads[0].other, { name: 'Ghost investor', role: 'Investor', ghost: true, hint: 'Invests at Seed' });
	await keep(fay.get(`/threads/${t.id}`));
	await keep(fay.get(`/threads/${t.id}/messages`));
	await keep(fay.post(`/threads/${t.id}/messages`, { text: 'Sure, what would you like to know?' }));
	await keep(fay.post(`/threads/${t.id}/accept`)); // already active now: an error response
	await keep(fay.post(`/threads/${t.id}/reveal`, { confirm: true })); // not the founder's to do
	await keep(fay.get('/inbox/summary'));
	await keep(fay.get('/notifications'));
	await keep(fay.get('/founder/overview'));
	const json = JSON.stringify(responses);
	for (const leak of ['Zed', 'Quill7Q', 'zq7', 'Quillstone', zed.id]) assert.ok(!json.includes(leak), `founder saw "${leak}"`);
	assert.ok(json.includes('Ghost investor wants to talk about'), 'the request notification names a ghost');

	// Sharing the name needs a confirm, happens once, and leaves a line in the chat.
	assert.equal((await zed.post(`/threads/${t.id}/reveal`, {})).status, 400);
	assert.equal((await zed.post(`/threads/${t.id}/reveal`, { confirm: true })).status, 200);
	assert.equal((await zed.post(`/threads/${t.id}/reveal`, { confirm: true })).status, 409);
	assert.deepEqual((await fay.get(`/threads/${t.id}`)).body.other, { name: 'Zed Quill7Q', role: 'Investor', ghost: false, firm: 'Quillstone Capital' });
	const msgs = (await fay.get(`/threads/${t.id}/messages`)).body;
	assert.equal(msgs.at(-1).kind, 'event');
	assert.match(msgs.at(-1).text, /Zed Quill7Q \(Quillstone Capital\) shared their name/);

	// This founder knows Zed now: a second chat starts named.
	const t2 = await begin(zed, await newIdea(fay, 'Second idea'));
	assert.equal((await fay.get(`/threads/${t2.id}`)).body.other.ghost, false);
});

test('turning Ghost Mode off only changes new chats', async () => {
	const zed = await newUser('investor', 'Zed');
	const cole = await newUser('founder', 'Cole');
	const dee = await newUser('founder', 'Dee');
	const old = await begin(zed, await newIdea(cole));
	await ghostOff(zed);
	assert.equal((await zed.get('/auth/me')).body.ghostMode, false);
	assert.equal((await cole.get(`/threads/${old.id}`)).body.other.name, 'Ghost investor');
	const fresh = await begin(zed, await newIdea(dee));
	assert.equal((await dee.get(`/threads/${fresh.id}`)).body.other.name, 'Zed');
});

test('committing money shows the investor in their ghost chats with that founder', async () => {
	const zed = await newUser('investor', 'Zed');
	const fay = await newUser('founder', 'Fay');
	const ideaId = await newIdea(fay);
	const t = await begin(zed, ideaId);
	assert.equal((await zed.post('/investor/commit', { ideaId, amount: 500 })).status, 201);
	assert.equal((await fay.get(`/threads/${t.id}`)).body.other.name, 'Zed');
	assert.match((await fay.get(`/threads/${t.id}/messages`)).body.at(-1).text, /Zed committed to “Campus compost”, so their name is now shown/);
});

test('requests: the requester waits, a reply accepts, and declines are quiet with a cooldown', async () => {
	const ivan = await newUser('investor', 'Ivan');
	await ghostOff(ivan);
	const fay = await newUser('founder', 'Fay');
	const t = await begin(ivan, await newIdea(fay));
	assert.equal(t.status, 'request_out');
	assert.equal(t.canSend, false);
	const again = await ivan.post(`/threads/${t.id}/messages`, { text: 'Hello?' });
	assert.equal(again.status, 409);
	assert.equal(again.body.code, 'WAITING');

	assert.equal((await fay.get(`/threads/${t.id}`)).body.status, 'request_in');
	const reply = await fay.post(`/threads/${t.id}/messages`, { text: 'Happy to talk' });
	assert.equal(reply.status, 201);
	assert.equal(reply.body.thread.status, 'active');
	assert.equal((await ivan.post(`/threads/${t.id}/messages`, { text: 'Great' })).status, 201);
	await settle();
	const ivanNotes = (await BaseUser.findById(ivan.id).lean()).notifications;
	assert.ok(ivanNotes.some((n) => n.text === 'Fay replied to you about “Campus compost”' && n.link === `/investor/chats?thread=${t.id}`));
	const fayNotes = (await BaseUser.findById(fay.id).lean()).notifications;
	assert.ok(fayNotes.some((n) => n.text === 'Ivan wants to talk about “Campus compost”' && n.link === `/founder/chats?thread=${t.id}`));

	// A declined request: no notification, "No reply" for the requester, and a 30-day cooldown.
	const cole = await newUser('founder', 'Cole');
	const second = await newIdea(fay, 'Second idea');
	const ask = await begin(cole, second, 'Could I help with this?');
	const before = (await BaseUser.findById(cole.id).lean()).notifications.length;
	assert.equal((await fay.post(`/threads/${ask.id}/decline`)).status, 200);
	await settle();
	assert.equal((await BaseUser.findById(cole.id).lean()).notifications.length, before);
	const seen = (await cole.get(`/threads/${ask.id}`)).body;
	assert.deepEqual([seen.status, seen.reason], ['closed', 'No reply. You can ask again later.']);
	const retry = await cole.post('/threads', { ideaId: second, text: 'Please?' });
	assert.equal(retry.status, 429);
	assert.equal(retry.body.code, 'COOLDOWN');
	assert.doesNotMatch(retry.body.message, /declin/i);
});

test('one open thread per idea, retries land once, links wait, and the pending cap holds', async () => {
	const ivan = await newUser('investor', 'Ivan');
	const fay = await newUser('founder', 'Fay');
	const ideaId = await newIdea(fay);

	const starts = await Promise.all(Array.from({ length: 10 }, () => ivan.post('/threads', { ideaId, text: 'Hi there' })));
	assert.ok(starts.every((r) => [200, 201].includes(r.status)));
	assert.equal(new Set(starts.map((r) => r.body.thread.id)).size, 1);
	assert.equal(await Thread.countDocuments({}), 1);
	const t = starts[0].body.thread;

	await fay.post(`/threads/${t.id}/messages`, { text: 'Hello' });
	const sends = await Promise.all([1, 2, 3].map(() => ivan.post(`/threads/${t.id}/messages`, { text: 'Once', clientId: 'c-123' })));
	assert.ok(sends.every((r) => r.status === 201));
	assert.equal(await Message.countDocuments({ clientId: 'c-123' }), 1);

	const other = await newIdea(fay, 'Other idea');
	for (const text of ['See https://example.com/deck', 'Our deck is at acme.io']) {
		const r = await ivan.post('/threads', { ideaId: other, text });
		assert.equal(r.body.code, 'LINK_IN_REQUEST');
	}
	assert.equal((await ivan.post('/threads', { ideaId: other, text: 'what the fuck' })).body.code, 'BLOCKED_WORDS');
	assert.equal((await fay.post('/threads', { ideaId, text: 'Talking to myself' })).status, 400);

	// 20 requests may wait at once (the first thread is active now, so it doesn't count).
	const many = await Idea.insertMany(Array.from({ length: 21 }, (_, i) => ({
		founder_id: fay.id, author: 'Fay', title: `Bulk ${i}`, description: 'x', desc: 'x', isDraft: false,
	})));
	for (const i of many.slice(0, 20)) await begin(ivan, i._id);
	const capped = await ivan.post('/threads', { ideaId: many[20]._id, text: 'One more' });
	assert.equal(capped.status, 429);
	assert.equal(capped.body.code, 'TOO_MANY_PENDING');
});

test('unread counts, the after cursor, strangers and blocks', async () => {
	const ivan = await newUser('investor', 'Ivan');
	await ghostOff(ivan);
	const fay = await newUser('founder', 'Fay');
	const ideaId = await newIdea(fay);
	const t = await begin(ivan, ideaId);

	let sum = (await fay.get('/inbox/summary')).body.chats;
	assert.deepEqual([sum.incomingRequests, sum.unreadThreads, sum.unreadMessages], [1, 1, 1]);
	await fay.post(`/threads/${t.id}/read`);
	sum = (await fay.get('/inbox/summary')).body.chats;
	assert.deepEqual([sum.unreadThreads, sum.unreadMessages], [0, 0]);

	// `after` overlaps by 2 s (the client drops repeats), so space the messages out.
	await fay.post(`/threads/${t.id}/messages`, { text: 'One' });
	await new Promise((r) => setTimeout(r, 2100));
	const two = await fay.post(`/threads/${t.id}/messages`, { text: 'Two' });
	const newer = (await ivan.get(`/threads/${t.id}/messages?after=${encodeURIComponent(two.body.message.at)}`)).body;
	assert.deepEqual(newer.map((m) => m.text), ['Two']);
	assert.equal((await ivan.get('/inbox/summary')).body.chats.unreadMessages, 2);

	const cole = await newUser('founder', 'Cole');
	for (const r of [cole.get(`/threads/${t.id}`), cole.get(`/threads/${t.id}/messages`), cole.post(`/threads/${t.id}/messages`, { text: 'Hi' })]) {
		assert.equal((await r).status, 404);
	}
	assert.equal((await cole.get('/threads')).body.threads.length, 0);

	assert.equal((await fay.post(`/threads/${t.id}/block`)).status, 200);
	assert.equal((await ivan.get(`/threads/${t.id}`)).body.status, 'closed');
	assert.equal((await ivan.post(`/threads/${t.id}/messages`, { text: 'Hello?' })).status, 409);
	assert.equal((await ivan.post('/threads', { ideaId, text: 'Hi again' })).status, 403);
});

test('a message can be reported only by the other person, and lands in the admin queue', async () => {
	const ivan = await newUser('investor', 'Ivan');
	const fay = await newUser('founder', 'Fay');
	const t = await begin(ivan, await newIdea(fay), 'Buy my course');
	const [m] = (await fay.get(`/threads/${t.id}/messages`)).body;
	const cole = await newUser('founder', 'Cole');
	assert.equal((await cole.post('/reports', { type: 'message', id: m.id, reason: 'spam' })).status, 404);
	assert.equal((await ivan.post('/reports', { type: 'message', id: m.id, reason: 'spam' })).status, 400);
	assert.equal((await fay.post('/reports', { type: 'message', id: m.id, reason: 'spam' })).status, 201);

	const saved = process.env.ADMIN_EMAILS;
	process.env.ADMIN_EMAILS = cole.email;
	await verifyEmail(cole.email);
	try {
		const queue = (await cole.get('/admin/moderation?view=reported')).body;
		assert.equal(queue[0].type, 'message');
		assert.equal(queue[0].place.kind, 'chat');
	} finally {
		if (saved === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = saved;
	}
});

test('deleting an account removes its chats for both sides', async () => {
	const ivan = await newUser('investor', 'Ivan');
	const fay = await newUser('founder', 'Fay');
	const t = await begin(ivan, await newIdea(fay));
	await fay.post(`/threads/${t.id}/messages`, { text: 'Hi' });
	assert.equal((await ivan.del('/auth/account', { confirmEmail: ivan.email })).status, 200);
	assert.equal((await fay.get('/threads')).body.threads.length, 0);
	assert.equal(await Message.countDocuments({}), 0);
});
