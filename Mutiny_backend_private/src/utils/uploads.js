// Every file a user uploads goes through here (X-5–X-8, X-96). The rules:
// - the owner and the id are checked before multer writes a byte (routes do that first);
// - the stored name is random and its extension comes from our own type list, never the client's;
// - the first bytes must match the declared type, because multer trusts the client's Content-Type;
// - nothing uploaded can render as a page on our origin: `nosniff` everywhere, a sandboxing CSP on
//   avatars, and attachments are served only to people who may see the idea.
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const MAX_ATTACHMENTS = 20; // per idea
const UPLOADS_ROOT = path.join(__dirname, '../../uploads');
const AVATARS_DIR  = path.join(UPLOADS_ROOT, 'avatars');
const IDEAS_DIR    = path.join(UPLOADS_ROOT, 'ideas');

const startsWith = (buf, bytes, at = 0) => bytes.every((b, i) => buf[at + i] === b);
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

// The first bytes each type must start with.
const MAGIC = {
	pdf:  (b) => b.subarray(0, 1024).includes(Buffer.from('%PDF-')),
	ole:  (b) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), // .doc, .ppt
	zip:  (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]),                         // .docx, .pptx
	isoMedia: (b) => ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip'].some((box) => startsWith(b, ascii(box), 4)),
	webm: (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]),
	mp3:  (b) => startsWith(b, ascii('ID3')) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
	wav:  (b) => startsWith(b, ascii('RIFF')) && startsWith(b, ascii('WAVE'), 8),
	ogg:  (b) => startsWith(b, ascii('OggS')),
	jpeg: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
	png:  (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
	gif:  (b) => startsWith(b, ascii('GIF87a')) || startsWith(b, ascii('GIF89a')),
	webp: (b) => startsWith(b, ascii('RIFF')) && startsWith(b, ascii('WEBP'), 8),
};

const AVATAR_TYPES = {
	'image/jpeg': { ext: '.jpg',  magic: MAGIC.jpeg },
	'image/png':  { ext: '.png',  magic: MAGIC.png },
	'image/webp': { ext: '.webp', magic: MAGIC.webp },
	'image/gif':  { ext: '.gif',  magic: MAGIC.gif },
};

const ATTACHMENT_TYPES = {
	'application/pdf': { ext: '.pdf', kind: 'document', magic: MAGIC.pdf },
	'application/msword': { ext: '.doc', kind: 'document', magic: MAGIC.ole },
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: '.docx', kind: 'document', magic: MAGIC.zip },
	'application/vnd.ms-powerpoint': { ext: '.ppt', kind: 'presentation', magic: MAGIC.ole },
	'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ext: '.pptx', kind: 'presentation', magic: MAGIC.zip },
	'video/mp4':       { ext: '.mp4',  kind: 'video', magic: MAGIC.isoMedia },
	'video/webm':      { ext: '.webm', kind: 'video', magic: MAGIC.webm },
	'video/quicktime': { ext: '.mov',  kind: 'video', magic: MAGIC.isoMedia },
	'audio/mpeg':      { ext: '.mp3',  kind: 'audio', magic: MAGIC.mp3 },
	'audio/wav':       { ext: '.wav',  kind: 'audio', magic: MAGIC.wav },
	'audio/ogg':       { ext: '.ogg',  kind: 'audio', magic: MAGIC.ogg },
};

// Only names we generated: 32 hex characters and one of our extensions. Anything else (a path,
// "..", a client's own file name) is never joined onto a folder.
const STORED_NAME = /^[a-f0-9]{32}\.(jpg|png|webp|gif|pdf|docx?|pptx?|mp4|webm|mov|mp3|wav|ogg)$/;
const isStoredName = (name) => typeof name === 'string' && STORED_NAME.test(name);

const randomName = (ext) => `${crypto.randomBytes(16).toString('hex')}${ext}`;

const badRequest = (message) => Object.assign(new Error(message), { status: 400, expose: true });

/** multer fileFilter for a type table: unknown types are a 400, not a 500. */
const filterFor = (types, message) => (req, file, cb) =>
	types[file.mimetype] ? cb(null, true) : cb(badRequest(message), false);

/** multer filename: random, with our extension for the declared type. */
const filenameFor = (types) => (req, file, cb) => cb(null, randomName(types[file.mimetype].ext));

/**
 * multer destination for avatars. diskStorage doesn't create folders, and a fresh clone (or CI) has
 * no uploads/ yet, so the folder is made here, where the file is written, not at server start.
 */
const avatarDestination = (req, file, cb) =>
	fs.promises.mkdir(AVATARS_DIR, { recursive: true }).then(() => cb(null, AVATARS_DIR), cb);

/** Deletes a file we stored, by its stored name only, inside `dir` only. Never throws. */
const removeStored = async (dir, name) => {
	if (!isStoredName(name)) return;
	const target = path.join(dir, name);
	if (path.dirname(target) !== dir) return;
	await fs.promises.unlink(target).catch(() => {});
};

/**
 * Runs after multer: the file's first bytes must match its declared type. A mismatch removes the
 * file and answers 400, so a page or script renamed to .pdf never stays on disk.
 */
const checkMagic = (types) => async (req, res, next) => {
	if (!req.file) return next();
	try {
		const handle = await fs.promises.open(req.file.path, 'r');
		const head = Buffer.alloc(1024);
		try {
			await handle.read(head, 0, head.length, 0);
		} finally {
			await handle.close();
		}
		if (types[req.file.mimetype]?.magic(head)) return next();
	} catch {
		// unreadable: treat as a mismatch
	}
	await fs.promises.unlink(req.file.path).catch(() => {});
	return res.status(400).json({ success: false, message: "That file's contents don't match its type" });
};

/** The stored name at the end of one of our upload URLs, or null. */
const storedNameOf = (url) => {
	const name = typeof url === 'string' ? url.split('/').pop() : null;
	return isStoredName(name) ? name : null;
};

/** Removes an avatar file given the URL saved on the profile (only our own avatar URLs). */
const removeAvatar = async (url) => {
	if (typeof url !== 'string' || !url.startsWith('/uploads/avatars/')) return;
	await removeStored(AVATARS_DIR, storedNameOf(url));
};

// Headers for anything we serve back: never sniffed into HTML, never a page that runs scripts.
const NO_RENDER = {
	'X-Content-Type-Options': 'nosniff',
	'Content-Security-Policy': "default-src 'none'; sandbox",
	'Cross-Origin-Resource-Policy': 'cross-origin',
};

module.exports = {
	MAX_ATTACHMENTS, UPLOADS_ROOT, AVATARS_DIR, IDEAS_DIR, AVATAR_TYPES, ATTACHMENT_TYPES, NO_RENDER,
	isStoredName, storedNameOf, filterFor, filenameFor, avatarDestination, checkMagic, removeStored, removeAvatar, badRequest,
};
