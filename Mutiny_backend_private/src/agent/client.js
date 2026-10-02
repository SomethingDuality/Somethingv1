// Calls from Node to the Python agent service (127.0.0.1:8000). The browser never talks to
// Python: Node checks the login cookie, then calls the agent with its service key and the user's
// id/role in headers. Cookies are never forwarded.
const crypto = require('crypto');

const AGENT_URL = () => (process.env.AGENT_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const enabled = () => process.env.AGENT_ENABLED !== 'false' && Boolean(process.env.NODE_TO_AGENT_KEY);

class AgentUnavailable extends Error {
	constructor(status, code, message) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

const headersFor = (user, extra = {}) => ({
	'content-type': 'application/json',
	'x-agent-key': process.env.NODE_TO_AGENT_KEY || '',
	'x-request-id': crypto.randomUUID(),
	...(user?._id && { 'x-agent-user-id': String(user._id) }),
	...(user?.role && { 'x-agent-user-role': String(user.role) }),
	...(user?.tz && { 'x-agent-user-tz': String(user.tz).slice(0, 64) }),
	...extra,
});

// Returns the fetch Response. `timeoutMs` bounds the time until headers arrive. The caller's
// `signal` stays linked for the whole response, body included, so aborting it later (the browser
// left an SSE stream) also cancels the upstream request. Redirects are never followed: the
// request carries the service key.
const agentFetch = async (path, { method = 'GET', body, user, timeoutMs = 5000, signal } = {}) => {
	if (!enabled()) throw new AgentUnavailable(503, 'agent_disabled', 'Reviews are not available right now.');
	const timer = new AbortController();
	const t = setTimeout(() => timer.abort(), timeoutMs);
	try {
		return await fetch(AGENT_URL() + path, {
			method,
			headers: headersFor(user),
			body: body === undefined ? undefined : JSON.stringify(body),
			signal: signal ? AbortSignal.any([signal, timer.signal]) : timer.signal,
			redirect: 'error',
		});
	} catch (err) {
		if (signal?.aborted) throw err;
		if (timer.signal.aborted) throw new AgentUnavailable(504, 'agent_timeout', 'The review service took too long. Please try again.');
		throw new AgentUnavailable(503, 'agent_unavailable', 'The review service is not reachable right now.');
	} finally {
		clearTimeout(t);
	}
};

// JSON call: 2xx and 4xx pass through (they carry user-safe codes); 5xx becomes a plain 502.
const agentJSON = async (path, opts = {}) => {
	const res = await agentFetch(path, opts);
	let data = null;
	try { data = await res.json(); } catch { data = null; }
	// The agent refusing our service key is our misconfiguration, not the user's session.
	if (res.status === 401 || res.status === 403 && data?.code === 'unauthorized') {
		throw new AgentUnavailable(502, 'agent_auth', 'The review service had a problem. Please try again.');
	}
	if (res.status >= 500) {
		const err = new AgentUnavailable(res.status === 503 ? 503 : 502, data?.code || 'agent_error', data?.message || 'The review service had a problem. Please try again.');
		err.body = data;
		throw err;
	}
	return { status: res.status, body: data };
};

// Express helper: send an AgentUnavailable (or anything else) as JSON.
const sendAgentError = (res, err) => {
	if (err instanceof AgentUnavailable) {
		return res.status(err.status).json({ success: false, code: err.code, message: err.message, ...(err.body?.retryable !== undefined && { retryable: err.body.retryable }) });
	}
	console.error('[agent] unexpected error:', err?.message);
	return res.status(500).json({ success: false, code: 'internal', message: 'Something went wrong. Please try again.' });
};

module.exports = { agentFetch, agentJSON, sendAgentError, AgentUnavailable, enabled, headersFor, AGENT_URL };
