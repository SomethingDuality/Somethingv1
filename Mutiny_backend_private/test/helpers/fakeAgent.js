// A stand-in for the Python agent's internal API, so Node tests don't need Python. It records
// every request and serves the same contract as agent/app/api (SSE frames included).
const http = require('http');

const NODE_TO_AGENT_KEY = 'test-node-to-agent';

const startFakeAgent = async () => {
	const state = { requests: [], events: [], erased: [], down: false, routes: new Map() };
	const server = http.createServer(async (req, res) => {
		let raw = '';
		for await (const chunk of req) raw += chunk;
		const body = raw ? JSON.parse(raw) : undefined;
		const url = new URL(req.url, 'http://x');
		state.requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), headers: req.headers, body });
		const json = (status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
		if (req.headers['x-agent-key'] !== NODE_TO_AGENT_KEY) return json(401, { detail: { code: 'unauthorized' } });
		if (state.down) return json(503, { code: 'provider_unavailable', message: 'down', retryable: true });
		const custom = state.routes.get(`${req.method} ${url.pathname}`);
		if (custom) return custom(req, res, { body, query: Object.fromEntries(url.searchParams), json });
		if (url.pathname === '/internal/health') return json(200, { status: 'ok', fakeLlm: true });
		if (url.pathname === '/internal/events') { state.events.push(body); return json(202, { status: 'queued' }); }
		if (url.pathname === '/internal/erase') { state.erased.push(body); return json(200, { cancelled: 0 }); }
		if (url.pathname === '/internal/diagnostics/echo' && req.method === 'POST') return json(200, { runId: 'abcdef0123456789' });
		if (/^\/internal\/confirms\/[a-z0-9]+\/resolve$/.test(url.pathname)) { (state.confirms ||= []).push({ id: url.pathname.split('/')[3], ...body, user: req.headers['x-agent-user-id'] }); return json(200, { ok: true }); }
		const m = url.pathname.match(/^\/internal\/diagnostics\/echo\/([a-f0-9]+)\/stream$/);
		if (m) {
			if (req.headers['x-agent-user-id'] !== state.owner && state.owner) return json(404, { detail: { code: 'not_found' } });
			const after = Number(url.searchParams.get('after') || 0);
			res.writeHead(200, { 'content-type': 'text/event-stream' });
			const frames = [['progress', { stage: 'ping', text: 'Ping received.' }], ['echo', { message: 'hi' }], ['interrupt', { kind: 'echo' }]];
			frames.forEach(([event, data], i) => { if (i + 1 > after) res.write(`id: ${i + 1}\nevent: ${event}\ndata: ${JSON.stringify({ v: 1, ...data })}\n\n`); });
			return res.end();
		}
		return json(404, { detail: { code: 'not_found' } });
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	state.url = `http://127.0.0.1:${server.address().port}`;
	state.stop = () => new Promise((r) => server.close(r));
	state.reset = () => { state.requests.length = 0; state.events.length = 0; state.erased.length = 0; state.down = false; state.routes.clear(); state.owner = undefined; state.confirms = []; };
	return state;
};

module.exports = { startFakeAgent, NODE_TO_AGENT_KEY };
