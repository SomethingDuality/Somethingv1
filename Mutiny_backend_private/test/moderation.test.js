// Community C1: word filter, reports, auto-hide, the admin queue and visibility of hidden items.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, resetDb, agent, verifyEmail, trustReporter } = require('./helpers/server.js');

let Idea, Comment, BaseUser, Report;

before(async () => {
	await start();
	({ Idea }     = require('../src/models/ideas.model.js'));
	({ Comment }  = require('../src/models/comments.model.js'));
	({ BaseUser } = require('../src/models/user.model.js'));
	({ Report }   = require('../src/models/report.model.js'));
	await Report.init(); // the unique index must exist before the parallel test
});
after(stop);
beforeEach(resetDb);

const newUser = async (role, name) => {
	const a = agent();
	a.email = `${name.toLowerCase()}@example.test`;
	const res = await a.post('/auth/signup', { name, email: a.email, password: 'long enough pw', role, accepted_terms: true });
	assert.equal(res.status, 201, JSON.stringify(res.body));
	a.id = res.body.user._id;
	return a;
};
const newIdea = async (founder, extra = {}) => {
	const res = await founder.post('/ideas', { title: 'Edge Vision', description: 'Cheap vision kits for farms', ...extra });
	assert.equal(res.status, 201, JSON.stringify(res.body));
	return res.body._id;
};
// Reporters whose reports count toward hiding (verified, a day old).
const reporters = (n, prefix = 'R') => Promise.all(Array.from({ length: n }, async (_, i) => {
	const r = await newUser('investor', `${prefix}${i}x`);
	await trustReporter(r.email);
	return r;
}));
const asAdmin = async (fn, admin) => {
	const saved = process.env.ADMIN_EMAILS;
	process.env.ADMIN_EMAILS = admin.email;
	await verifyEmail(admin.email);
	try { return await fn(); } finally {
		if (saved === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = saved;
	}
};
const notes = async (user) => (await BaseUser.findById(user.id).lean()).notifications || [];

test('the word filter blocks public posts, lets drafts be, and queues review terms', async () => {
	const fay = await newUser('founder', 'Fay');
	const blocked = await fay.post('/ideas', { title: 'F u c k fees', description: 'Payments' });
	assert.equal(blocked.status, 400);
	assert.equal(blocked.body.code, 'BLOCKED_WORDS');

	// A draft is private, so it isn't filtered until it's published.
	const draftId = await newIdea(fay, { title: 'F u c k fees', isDraft: true });
	assert.equal((await fay.put(`/ideas/${draftId}`, { isDraft: false })).status, 400);

	const flaggedId = await newIdea(fay, { description: 'Guaranteed returns for every saver' });
	const flagged = await Idea.findById(flaggedId).lean();
	assert.equal(flagged.moderation.needsReview, true);
	assert.deepEqual(flagged.moderation.flaggedTerms, ['guaranteed returns']);
	// The founder's own view never shows the flagged terms.
	assert.equal((await fay.get(`/ideas/${flaggedId}`)).body.moderation, undefined);

	const ivan = await newUser('investor', 'Ivan');
	assert.equal((await ivan.post(`/ideas/${flaggedId}/comments`, { text: 'what the fuuuck' })).status, 400);
	assert.equal((await ivan.post(`/ideas/${flaggedId}/comments`, { text: 'Is this a guaranteed returns thing?' })).status, 201);
	assert.equal((await Comment.findOne({}).lean()).moderation.needsReview, true);

	const queue = await asAdmin(() => fay.get('/admin/moderation?view=review'), fay);
	assert.equal(queue.status, 200);
	assert.deepEqual(queue.body.map((i) => i.type).sort(), ['comment', 'idea']);
});

test('reports: one per person, never on your own post, and five hide an idea', async () => {
	const fay = await newUser('founder', 'Fay');
	const ideaId = await newIdea(fay);
	const [first, ...rest] = await reporters(5);

	assert.equal((await fay.post('/reports', { type: 'idea', id: ideaId, reason: 'spam' })).status, 400);
	assert.equal((await first.post('/reports', { type: 'idea', id: ideaId, reason: 'nonsense' })).status, 400);
	assert.equal((await first.post('/reports', { type: 'idea', id: ideaId, reason: 'spam', note: 'Same post everywhere' })).status, 201);
	const again = await first.post('/reports', { type: 'idea', id: ideaId, reason: 'scam' });
	assert.equal(again.status, 200);
	assert.equal(again.body.alreadyReported, true);

	for (const r of rest.slice(0, 3)) await r.post('/reports', { type: 'idea', id: ideaId, reason: 'spam' });
	assert.equal((await Idea.findById(ideaId).lean()).moderation.state, undefined); // 4 reports: still up
	await rest[3].post('/reports', { type: 'idea', id: ideaId, reason: 'scam' });
	assert.equal((await Idea.findById(ideaId).lean()).moderation.state, 'hidden');

	// Gone for everyone else...
	const ivan = await newUser('investor', 'Ivan');
	assert.equal((await ivan.get(`/ideas/${ideaId}`)).status, 404);
	assert.equal((await ivan.get('/ideas/discover')).body.length, 0);
	assert.equal((await ivan.post(`/ideas/${ideaId}/like`)).status, 404);
	assert.equal((await ivan.post(`/ideas/${ideaId}/comments`, { text: 'Hello' })).status, 404);
	assert.equal((await ivan.post('/investor/commit', { ideaId, amount: 100 })).status, 404);
	assert.equal((await ivan.post(`/investor/watchlist/${ideaId}`)).status, 404);
	// ...but the founder still sees it, marked, and was told once, with a link to it.
	const own = await fay.get(`/ideas/${ideaId}`);
	assert.equal(own.status, 200);
	assert.deepEqual(own.body.moderation, { state: 'hidden' });
	const told = (await notes(fay)).filter((n) => /is hidden while we look/.test(n.text));
	assert.equal(told.length, 1);
	assert.equal(told[0].link, `/founder/ideas/${ideaId}`);
});

test('parallel reports from one person count once', async () => {
	const fay = await newUser('founder', 'Fay');
	const ideaId = await newIdea(fay);
	const ivan = await newUser('investor', 'Ivan');
	await Promise.all(Array.from({ length: 10 }, () => ivan.post('/reports', { type: 'idea', id: ideaId, reason: 'spam' })));
	assert.equal(await Report.countDocuments({}), 1);
	assert.equal((await Idea.findById(ideaId).lean()).moderation.reportCount, 1);
});

test('three reports hide a comment; its author still sees it, marked', async () => {
	const fay = await newUser('founder', 'Fay');
	const ideaId = await newIdea(fay);
	const cole = await newUser('founder', 'Cole');
	const posted = await cole.post(`/ideas/${ideaId}/comments`, { text: 'Buy my course instead' });
	const commentId = posted.body.comment.id;
	assert.equal((await Idea.findById(ideaId).lean()).comments, 1);

	for (const r of await reporters(3)) await r.post('/reports', { type: 'comment', id: commentId, reason: 'spam' });
	assert.equal((await Comment.findById(commentId).lean()).moderation.state, 'hidden');
	assert.equal((await Idea.findById(ideaId).lean()).comments, 0);

	assert.equal((await fay.get(`/ideas/${ideaId}/comments`)).body.comments.length, 0);
	const own = (await cole.get(`/ideas/${ideaId}/comments`)).body.comments;
	assert.equal(own.length, 1);
	assert.equal(own[0].hidden, 'hidden');

	// Deleting a hidden comment doesn't take the count below zero.
	assert.equal((await cole.del(`/ideas/comments/${commentId}`)).status, 200);
	assert.equal((await Idea.findById(ideaId).lean()).comments, 0);
});

test('admins see the queue and decide; everyone else gets a 404', async () => {
	const fay = await newUser('founder', 'Fay');
	const cole = await newUser('founder', 'Cole');
	const ideaId = await newIdea(cole);
	for (const r of await reporters(5)) await r.post('/reports', { type: 'idea', id: ideaId, reason: 'off_topic', note: 'Not a startup' });

	assert.equal((await fay.get('/admin/moderation')).status, 404);
	assert.equal((await fay.post(`/admin/moderation/idea/${ideaId}`, { action: 'approve' })).status, 404);

	await asAdmin(async () => {
		const queue = await fay.get('/admin/moderation?view=hidden');
		assert.equal(queue.status, 200);
		assert.equal(queue.body.length, 1);
		assert.equal(queue.body[0].reasons.off_topic, 5);
		assert.equal(queue.body[0].author, 'Cole');
		assert.equal(queue.body[0].notes[0], 'Not a startup');

		// Approve: back up, and immune to later reports.
		assert.equal((await fay.post(`/admin/moderation/idea/${ideaId}`, { action: 'approve' })).status, 200);
		for (const r of await reporters(5, 'S')) await r.post('/reports', { type: 'idea', id: ideaId, reason: 'spam' });
		assert.equal((await Idea.findById(ideaId).lean()).moderation.state, 'approved');
		assert.equal((await agent().get(`/ideas/${ideaId}`)).status, 200);

		// Remove: down for good, and the founder is told.
		assert.equal((await fay.post(`/admin/moderation/idea/${ideaId}`, { action: 'remove' })).status, 200);
		assert.equal((await agent().get(`/ideas/${ideaId}`)).status, 404);
		assert.ok((await notes(cole)).some((n) => /was removed because it breaks the community rules/.test(n.text)));
		assert.equal((await fay.post(`/admin/moderation/idea/${ideaId}`, { action: 'explode' })).status, 400);
	}, fay);
});

test("drafts can't be liked, commented on, committed to or reported by others", async () => {
	const fay = await newUser('founder', 'Fay');
	const draftId = await newIdea(fay, { isDraft: true });
	const ivan = await newUser('investor', 'Ivan');
	assert.equal((await ivan.post(`/ideas/${draftId}/like`)).status, 404);
	assert.equal((await ivan.post(`/ideas/${draftId}/comments`, { text: 'Hi' })).status, 404);
	assert.equal((await ivan.get(`/ideas/${draftId}/comments`)).status, 404);
	assert.equal((await ivan.post('/investor/commit', { ideaId: draftId, amount: 100 })).status, 404);
	assert.equal((await ivan.post('/reports', { type: 'idea', id: draftId, reason: 'spam' })).status, 404);
	// The founder can still comment on their own draft.
	assert.equal((await fay.post(`/ideas/${draftId}/comments`, { text: 'Note to self' })).status, 201);
});

test('deleting an account takes its comments and reports with it', async () => {
	const fay = await newUser('founder', 'Fay');
	const ideaId = await newIdea(fay);
	const cole = await newUser('founder', 'Cole');
	await cole.post(`/ideas/${ideaId}/comments`, { text: 'Nice one' });
	await cole.post('/reports', { type: 'idea', id: ideaId, reason: 'spam' });
	assert.equal((await Idea.findById(ideaId).lean()).comments, 1);
	assert.equal((await Idea.findById(ideaId).lean()).moderation.reportCount, 1);

	assert.equal((await cole.del('/auth/account', { confirmEmail: cole.email })).status, 200);
	const idea = await Idea.findById(ideaId).lean();
	assert.equal(idea.comments, 0);
	assert.equal(idea.moderation.reportCount, 0);
	assert.equal(await Comment.countDocuments({}), 0);
	assert.equal(await Report.countDocuments({}), 0);
});

test('notifications carry a link, and the inbox summary counts unread ones', async () => {
	const fay = await newUser('founder', 'Fay');
	const ideaId = await newIdea(fay);
	const cole = await newUser('founder', 'Cole');
	await cole.post(`/ideas/${ideaId}/collaborate`);
	await cole.post(`/ideas/${ideaId}/comments`, { text: 'Count me in' });

	const list = (await fay.get('/notifications')).body;
	assert.equal(list.length, 2);
	// The comment opens the idea; "Ask to join" opens the chat request it started (C5).
	assert.ok(list.some((n) => n.link === `/founder/ideas/${ideaId}`));
	assert.ok(list.some((n) => /^\/founder\/chats\?thread=[0-9a-f]{24}$/.test(n.link)));
	assert.equal((await fay.get('/inbox/summary')).body.notifications.unread, 2);
	await fay.post('/notifications/mark-all-read');
	assert.equal((await fay.get('/inbox/summary')).body.notifications.unread, 0);
	assert.equal((await agent().get('/inbox/summary')).status, 401);
});


test("new or unverified accounts can't hide a post; their reports still reach the admin queue", async () => {
	const cole = await newUser('founder', 'Cole');
	const ideaId = await newIdea(cole);
	const fresh = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => newUser('investor', `F${i}x`)));
	for (const r of fresh) assert.equal((await r.post('/reports', { type: 'idea', id: ideaId, reason: 'spam' })).status, 201);
	const idea = await Idea.findById(ideaId).lean();
	assert.notEqual(idea.moderation.state, 'hidden', 'six throwaway accounts hide nothing');
	assert.equal(idea.moderation.reportCount, 6);
	const fay = await newUser('founder', 'Fay');
	const queue = await asAdmin(() => fay.get('/admin/moderation?view=reported'), fay);
	assert.equal(queue.status, 200);
	assert.ok(queue.body.some((q) => String(q.id) === String(ideaId)), 'an admin still sees the reports');
});
