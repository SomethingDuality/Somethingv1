// Passes an SSE stream from the agent through to the browser, unbuffered. Closing the tab aborts
// the upstream request (the run itself keeps going in the agent; the client reconnects with
// ?after=<last event id> and gets what it missed). A user has at most MAX_PER_USER streams open,
// and shutdown ends them all (an open stream would hold the server open forever).
const { Readable } = require('stream');
const { agentFetch, sendAgentError } = require('./client.js');

const MAX_PER_USER = 6;
const open = new Set();
const perUser = new Map();

const closeAll = () => { for (const res of open) res.end(); };

const proxySSE = async (req, res, upstreamPath, user) => {
	const who = String(user?._id || '');
	if ((perUser.get(who) || 0) >= MAX_PER_USER) {
		return res.status(429).json({ success: false, code: 'too_many_streams', message: 'Too many open review streams. Close a tab and try again.' });
	}
	perUser.set(who, (perUser.get(who) || 0) + 1);
	open.add(res);
	const abort = new AbortController();
	// res, not req: a request's 'close' can fire as soon as its (empty) body is read.
	res.on('close', () => {
		abort.abort();
		open.delete(res);
		const n = (perUser.get(who) || 1) - 1;
		if (n > 0) perUser.set(who, n); else perUser.delete(who);
	});
	let upstream;
	try {
		upstream = await agentFetch(upstreamPath, { user, signal: abort.signal, timeoutMs: 10000 });
	} catch (err) {
		if (abort.signal.aborted) return undefined;
		return sendAgentError(res, err);
	}
	if (upstream.status !== 200 || !upstream.body) {
		let data = null;
		try { data = await upstream.json(); } catch { data = null; }
		// The agent refusing our service key (401/403 unauthorized) is ours to fix: a 401 here
		// would make the app refresh the user's session and retry forever.
		const ours = upstream.status >= 500 || upstream.status === 401 || (upstream.status === 403 && (data?.code || data?.detail?.code) === 'unauthorized');
		const status = ours ? 502 : upstream.status;
		return res.status(status).json({ success: false, code: data?.code || data?.detail?.code || 'agent_error', message: data?.message || data?.detail?.message || 'Not available.' });
	}
	res.status(200);
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache, no-transform');
	res.setHeader('Connection', 'keep-alive');
	res.setHeader('X-Accel-Buffering', 'no');
	res.flushHeaders();
	const body = Readable.fromWeb(upstream.body);
	body.on('error', () => res.end());
	res.on('close', () => body.destroy());
	body.pipe(res);
	return undefined;
};

module.exports = { proxySSE, closeAll };
