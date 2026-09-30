// Passes an SSE stream from the agent through to the browser, unbuffered. Closing the tab aborts
// the upstream request (the run itself keeps going in the agent; the client reconnects with
// ?after=<last event id> and gets what it missed).
const { Readable } = require('stream');
const { agentFetch, sendAgentError } = require('./client.js');

const proxySSE = async (req, res, upstreamPath, user) => {
	const abort = new AbortController();
	req.on('close', () => abort.abort());
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
		const status = upstream.status >= 500 ? 502 : upstream.status;
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
	body.pipe(res);
	return undefined;
};

module.exports = { proxySSE };
