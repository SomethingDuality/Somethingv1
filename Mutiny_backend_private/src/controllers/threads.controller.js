const chat = require('../chat/chat.service.js');

const fail = (res, err, label) => {
	if (err instanceof chat.ChatError) {
		return res.status(err.status).json({ success: false, message: err.message, ...(err.code && { code: err.code }) });
	}
	console.error(`${label}:`, err);
	return res.status(500).json({ success: false, message: 'Internal server error' });
};

const handle = (label, fn, status = 200) => async (req, res) => {
	try {
		return res.status(typeof status === 'function' ? status(req) : status).json(await fn(req));
	} catch (err) {
		return fail(res, err, label);
	}
};

// GET /threads
const list_threads = handle('list_threads', (req) => chat.listThreads({ user: req.user }));

// POST /threads { ideaId, text, clientId }: a new request (or the open one about this idea).
const start_thread = async (req, res) => {
	try {
		const { ideaId, text, clientId } = req.body || {};
		const out = await chat.startThread({ user: req.user, ideaId, text, clientId });
		return res.status(out.existing ? 200 : 201).json(out);
	} catch (err) {
		return fail(res, err, 'start_thread');
	}
};

const get_thread = handle('get_thread', (req) => chat.getThread({ user: req.user, threadId: req.params.id }));
const list_messages = handle('list_messages', (req) => chat.listMessages({ user: req.user, threadId: req.params.id, after: req.query.after }));
const send_message = handle('send_message', (req) => chat.sendMessage({
	user: req.user, threadId: req.params.id, text: req.body?.text, clientId: req.body?.clientId,
}), 201);
const accept = handle('accept', (req) => chat.accept({ user: req.user, threadId: req.params.id }));
const decline = handle('decline', (req) => chat.decline({ user: req.user, threadId: req.params.id }));
const read = handle('read', (req) => chat.markRead({ user: req.user, threadId: req.params.id }));
const reveal = handle('reveal', (req) => chat.reveal({ user: req.user, threadId: req.params.id, confirm: req.body?.confirm }));
const block = handle('block', (req) => chat.block({ user: req.user, threadId: req.params.id }));

module.exports = { list_threads, start_thread, get_thread, list_messages, send_message, accept, decline, read, reveal, block, fail };
