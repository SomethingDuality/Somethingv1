// Uploads (X-5–X-9, X-96): ids and owners are checked before anything is written, names are ours,
// contents must match the type, files reach only people who may see the idea, and nothing uploaded
// renders as a page.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { start, stop, resetDb, agent, baseUrl } = require('./helpers/server.js');

const UPLOADS = path.join(__dirname, '../uploads');
const PDF = '%PDF-1.4\n1 0 obj << >> endobj\n';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

let Idea;
before(async () => {
	await start();
	({ Idea } = require('../src/models/ideas.model.js'));
});
// The tests write into the real uploads/ folder (git-ignored); leave nothing behind.
const made = [];
after(async () => {
	for (const rel of made) fs.rmSync(path.join(UPLOADS, rel), { recursive: true, force: true });
	await stop();
});
beforeEach(resetDb);

const newUser = async (role, name) => {
	const a = agent();
	const email = `${name.toLowerCase()}@example.test`;
	const res = await a.post('/auth/signup', { name, email, password: 'long enough pw', role, accepted_terms: true });
	assert.equal(res.status, 201);
	a.id = res.body.user._id;
	return a;
};

const cookieOf = (a) => [...a.jar].map(([k, v]) => `${k}=${v}`).join('; ');

const send = async (a, urlPath, { field = 'file', body, type, name }) => {
	const form = new FormData();
	form.append(field, new Blob([body], { type }), name);
	const res = await fetch(`${baseUrl()}${urlPath}`, { method: 'POST', headers: a ? { cookie: cookieOf(a) } : {}, body: form });
	const text = await res.text();
	let json = null;
	try { json = JSON.parse(text); } catch { json = text; }
	return { status: res.status, body: json };
};

const get = (a, urlPath) => fetch(`${baseUrl()}${urlPath}`, { headers: a ? { cookie: cookieOf(a) } : {} });

const newIdea = async (fay, extra = {}) => {
	const res = await fay.post('/ideas', { title: 'Campus compost', description: 'Composting for canteens.', isDraft: false, ...extra });
	assert.equal(res.status, 201, JSON.stringify(res.body));
	made.push(path.join('ideas', String(res.body._id)));
	return res.body._id;
};

const filesIn = (ideaId) => {
	const dir = path.join(UPLOADS, 'ideas', String(ideaId));
	return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
};

test('only the owner can upload, and only to a real idea id', async () => {
	const fay = await newUser('Founder', 'Fay');
	const mo = await newUser('Founder', 'Mo');
	const id = await newIdea(fay);

	const stranger = await send(mo, `/ideas/${id}/attachments`, { body: PDF, type: 'application/pdf', name: 'deck.pdf' });
	assert.equal(stranger.status, 403);
	assert.deepEqual(filesIn(id), [], 'nothing was written for a stranger');

	const before = fs.readdirSync(path.join(UPLOADS, 'ideas')).length;
	const traversal = await send(fay, '/ideas/..%2F..%2Fsrc%2Fevil/attachments', { body: PDF, type: 'application/pdf', name: 'deck.pdf' });
	assert.equal(traversal.status, 400);
	assert.equal(fs.readdirSync(path.join(UPLOADS, 'ideas')).length, before, 'no folder was made from the URL');
	assert.equal(fs.existsSync(path.join(__dirname, '../src/evil')), false);
});

test('the stored name is random, the type must match the contents, and odd types are a 400', async () => {
	const fay = await newUser('Founder', 'Fay');
	const id = await newIdea(fay);

	const page = await send(fay, `/ideas/${id}/attachments`, { body: '<script>alert(1)</script>', type: 'application/pdf', name: 'deck.pdf' });
	assert.equal(page.status, 400);
	assert.deepEqual(filesIn(id), [], 'a page renamed to .pdf is removed');

	const html = await send(fay, `/ideas/${id}/attachments`, { body: '<p>hi</p>', type: 'text/html', name: 'x.html' });
	assert.equal(html.status, 400, 'a refused type is a 400, not a 500');
	assert.equal(html.body.message, 'File type not allowed');

	const ok = await send(fay, `/ideas/${id}/attachments`, { body: PDF, type: 'application/pdf', name: 'Pitch – déck.pdf' });
	assert.equal(ok.status, 201, JSON.stringify(ok.body));
	assert.equal(ok.body.attachment.name, 'Pitch – déck.pdf', 'UTF-8 names survive');
	assert.match(ok.body.attachment.url, new RegExp(`^/uploads/ideas/${id}/[a-f0-9]{32}\\.pdf$`));
	assert.equal(filesIn(id).length, 1);
});

test('files reach only signed-in people who may see the idea, and never as a sniffable page', async () => {
	const fay = await newUser('Founder', 'Fay');
	const ivan = await newUser('Investor', 'Ivan');
	const id = await newIdea(fay);
	const up = await send(fay, `/ideas/${id}/attachments`, { body: PDF, type: 'application/pdf', name: 'deck.pdf' });
	const url = up.body.attachment.url;

	assert.equal((await get(null, url)).status, 401, 'anonymous visitors get nothing');
	const seen = await get(ivan, url);
	assert.equal(seen.status, 200);
	assert.equal(seen.headers.get('x-content-type-options'), 'nosniff');
	assert.match(seen.headers.get('content-type'), /application\/pdf/);
	assert.match(seen.headers.get('content-disposition'), /^inline/);
	assert.equal(await seen.text(), PDF);

	// Back to a draft: only the founder can open it.
	assert.equal((await fay.put(`/ideas/${id}`, { isDraft: true })).status, 200);
	assert.equal((await get(ivan, url)).status, 404);
	assert.equal((await get(fay, url)).status, 200);

	// A file the idea no longer lists isn't served, even if a copy were on disk.
	const other = url.replace(/[a-f0-9]{32}/, 'a'.repeat(32));
	fs.copyFileSync(path.join(UPLOADS, url.replace('/uploads/', '')), path.join(UPLOADS, other.replace('/uploads/', '')));
	assert.equal((await get(fay, other)).status, 404);
	assert.equal((await get(fay, `/uploads/ideas/${id}/..%2F..%2F..%2Fpackage.json`)).status, 404);
	assert.equal((await get(fay, '/uploads/ideas')).status, 404, 'no listing');
});

test('the client cannot invent attachments; it can only keep or drop its own', async () => {
	const fay = await newUser('Founder', 'Fay');
	const id = await newIdea(fay, { attachments: [{ name: 'evil', url: 'https://phish.example/x' }] });
	assert.deepEqual((await Idea.findById(id).lean()).attachments, [], 'create ignores client files');

	const up = await send(fay, `/ideas/${id}/attachments`, { body: PDF, type: 'application/pdf', name: 'deck.pdf' });
	const kept = up.body.attachment;

	// Invented entries (a path as the name, an outside URL) are ignored; the real one stays.
	const injected = await fay.put(`/ideas/${id}`, { attachments: [kept, { name: '../../../src/app.js', url: 'javascript:alert(1)' }, { name: 'new.pdf' }] });
	assert.equal(injected.status, 200);
	assert.deepEqual(injected.body.attachments.map((a) => a.url), [kept.url]);

	// The arbitrary-delete path (X-6): a name with a path is never joined onto a folder.
	const del = await fay.del(`/ideas/${id}/attachments/${encodeURIComponent('../../../src/app.js')}`);
	assert.equal(del.status, 404);
	assert.ok(fs.existsSync(path.join(__dirname, '../src/app.js')));

	// Dropping it from the list removes it and its file.
	const dropped = await fay.put(`/ideas/${id}`, { attachments: [] });
	assert.equal(dropped.status, 200);
	assert.deepEqual(dropped.body.attachments, []);
	assert.deepEqual(filesIn(id), []);
});

test('deleting an attachment by its stored name removes the file', async () => {
	const fay = await newUser('Founder', 'Fay');
	const mo = await newUser('Founder', 'Mo');
	const id = await newIdea(fay);
	const up = await send(fay, `/ideas/${id}/attachments`, { body: PDF, type: 'application/pdf', name: 'deck.pdf' });
	const stored = up.body.attachment.url.split('/').pop();

	assert.equal((await mo.del(`/ideas/${id}/attachments/${stored}`)).status, 403);
	assert.equal((await fay.del(`/ideas/${id}/attachments/${stored}`)).status, 200);
	assert.deepEqual(filesIn(id), []);
	assert.equal((await fay.del(`/ideas/${id}/attachments/${stored}`)).status, 404);
});

test('avatars: our extension, real images only, never a page, and the old one is removed', async () => {
	const fay = await newUser('Founder', 'Fay');
	const page = await send(fay, '/founder/avatar', { field: 'avatar', body: '<script>alert(1)</script>', type: 'image/png', name: 'x.html' });
	assert.equal(page.status, 400);

	const first = await send(fay, '/founder/avatar', { field: 'avatar', body: PNG, type: 'image/png', name: 'x.html' });
	assert.equal(first.status, 200, JSON.stringify(first.body));
	assert.match(first.body.avatarUrl, /^\/uploads\/avatars\/[a-f0-9]{32}\.png$/, 'the extension is ours, not the client\'s');
	const served = await get(null, first.body.avatarUrl);
	assert.equal(served.status, 200);
	assert.equal(served.headers.get('x-content-type-options'), 'nosniff');
	assert.match(served.headers.get('content-security-policy'), /sandbox/);

	const second = await send(fay, '/founder/avatar', { field: 'avatar', body: PNG, type: 'image/png', name: 'me.png' });
	assert.equal(second.status, 200);
	made.push(second.body.avatarUrl.replace('/uploads/', ''));
	assert.equal(fs.existsSync(path.join(UPLOADS, first.body.avatarUrl.replace('/uploads/', ''))), false, 'the old picture is gone');

	const ivan = await newUser('Investor', 'Ivan');
	const wrongRole = await send(ivan, '/founder/avatar', { field: 'avatar', body: PNG, type: 'image/png', name: 'me.png' });
	assert.equal(wrongRole.status, 403);
	assert.equal((await get(null, '/uploads/avatars/nothing.png')).status, 404);
});
