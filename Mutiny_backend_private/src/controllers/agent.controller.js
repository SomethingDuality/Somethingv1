// Browser-facing agent routes (/agent/*). The user is already authenticated by `protect`; this
// forwards to the Python agent with the service key and passes its answers (and streams) back.
const { agentJSON, sendAgentError } = require('../agent/client.js');
const { proxySSE } = require('../agent/sse.js');

const userOf = (req) => ({ ...req.user, tz: req.get('x-user-tz') || req.query.tz });
const pass = (res, { status, body }) => res.status(status).json(body);
const after = (req) => Math.max(0, Number.parseInt(req.query.after, 10) || 0);
const isHex = (s) => /^[a-f0-9]{8,64}$/i.test(String(s || ''));

// GET /agent/status: is the agent reachable, and is it on fake models.
async function status(req, res) {
	try {
		const out = await agentJSON('/internal/health', { user: userOf(req), timeoutMs: 2000 });
		return res.json({ live: out.status === 200, fakeModels: Boolean(out.body?.fakeLlm) });
	} catch {
		return res.json({ live: false });
	}
}

// Diagnostics (dev only): an echo run that streams, pauses for a reply, and resumes.
async function echoStart(req, res) {
	try {
		return pass(res, await agentJSON('/internal/diagnostics/echo', { method: 'POST', user: userOf(req), body: { message: String(req.body?.message || '').slice(0, 200) } }));
	} catch (err) { return sendAgentError(res, err); }
}
async function echoStream(req, res) {
	if (!isHex(req.params.id)) return res.status(404).json({ success: false });
	return proxySSE(req, res, `/internal/diagnostics/echo/${req.params.id}/stream?after=${after(req)}`, userOf(req));
}
async function echoResume(req, res) {
	if (!isHex(req.params.id)) return res.status(404).json({ success: false });
	try {
		return pass(res, await agentJSON(`/internal/diagnostics/echo/${req.params.id}/resume`, { method: 'POST', user: userOf(req), body: { reply: String(req.body?.reply || '').slice(0, 200) } }));
	} catch (err) { return sendAgentError(res, err); }
}

// ---- Reviews (Something + Nothing on the Something page). Founders only (R9: investors never
// see a review). The agent enforces the daily quota and ownership; Node checks the login.
const isIdea = (s) => /^[a-f0-9]{24}$/i.test(String(s || ''));
const READERS = new Set(['something', 'nothing']);

async function reviewStatus(req, res) {
	try {
		const out = await agentJSON('/internal/reviews/status', { user: userOf(req), timeoutMs: 2000 });
		return out.status === 200 ? res.json(out.body) : res.json({ live: false });
	} catch {
		return res.json({ live: false });
	}
}

async function reviewStart(req, res) {
	const { ideaId, text } = req.body || {};
	const readers = Array.isArray(req.body?.readers) ? req.body.readers.filter((r) => READERS.has(r)) : ['something', 'nothing'];
	if (ideaId !== undefined && ideaId !== null && !isIdea(ideaId)) return res.status(400).json({ success: false, message: 'Invalid idea' });
	if (!ideaId && !(typeof text === 'string' && text.trim())) return res.status(400).json({ success: false, message: 'Pick an idea or write one' });
	if (typeof text === 'string' && text.length > 2000) return res.status(400).json({ success: false, message: 'Keep it under 2000 characters' });
	if (!readers.length) return res.status(400).json({ success: false, message: 'Pick Something, Nothing or both' });
	try {
		return pass(res, await agentJSON('/internal/reviews', {
			method: 'POST', user: userOf(req), timeoutMs: 8000,
			body: { ...(ideaId ? { ideaId } : { text: String(text).slice(0, 2000) }), readers },
		}));
	} catch (err) { return sendAgentError(res, err); }
}

async function reviewLatest(req, res) {
	const q = isIdea(req.query.ideaId) ? `?ideaId=${req.query.ideaId}` : '';
	try { return pass(res, await agentJSON(`/internal/reviews/latest${q}`, { user: userOf(req) })); } catch (err) { return sendAgentError(res, err); }
}

async function reviewGet(req, res) {
	if (!isHex(req.params.id)) return res.status(404).json({ success: false });
	try { return pass(res, await agentJSON(`/internal/reviews/${req.params.id}`, { user: userOf(req) })); } catch (err) { return sendAgentError(res, err); }
}

async function reviewStream(req, res) {
	if (!isHex(req.params.id)) return res.status(404).json({ success: false });
	return proxySSE(req, res, `/internal/reviews/${req.params.id}/stream?after=${after(req)}`, userOf(req));
}

async function reviewReact(req, res) {
	if (!isHex(req.params.id)) return res.status(404).json({ success: false });
	const { kind, riskId, text } = req.body || {};
	if (!['accept', 'dispute', 'done'].includes(kind)) return res.status(400).json({ success: false, message: 'kind must be accept, dispute or done' });
	if (kind !== 'done' && !/^a[1-6]$/.test(String(riskId || ''))) return res.status(400).json({ success: false, message: 'Which risk?' });
	if (kind === 'dispute' && !(typeof text === 'string' && text.trim())) return res.status(400).json({ success: false, message: 'Tell Nothing what it missed' });
	try {
		return pass(res, await agentJSON(`/internal/reviews/${req.params.id}/react`, {
			method: 'POST', user: userOf(req), body: { kind, ...(riskId && { riskId }), ...(text && { text: String(text).slice(0, 1500) }) },
		}));
	} catch (err) { return sendAgentError(res, err); }
}

async function reviewDelete(req, res) {
	if (!isHex(req.params.id)) return res.status(404).json({ success: false });
	try { return pass(res, await agentJSON(`/internal/reviews/${req.params.id}`, { method: 'DELETE', user: userOf(req) })); } catch (err) { return sendAgentError(res, err); }
}

// ---- Matched deal flow (every 7 days). Investors: ideas that fit them. Founders: ideas looking
// for their skills. An idea's founder sees only counts (Ghost Mode holds).
const MATCH_ACTIONS = new Set(['opened', 'saved', 'passed', 'asked']);

async function dealFlow(req, res) {
	try { return pass(res, await agentJSON('/internal/deal-flow', { user: userOf(req), timeoutMs: 15000 })); } catch (err) { return sendAgentError(res, err); }
}

async function dealFlowAct(req, res) {
	if (!isHex(req.params.id)) return res.status(404).json({ success: false });
	const action = req.body?.action;
	if (!MATCH_ACTIONS.has(action)) return res.status(400).json({ success: false, message: 'action must be opened, saved, passed or asked' });
	try { return pass(res, await agentJSON(`/internal/deal-flow/${req.params.id}`, { method: 'POST', user: userOf(req), body: { action } })); } catch (err) { return sendAgentError(res, err); }
}

async function ideaReach(req, res) {
	if (!isIdea(req.params.id)) return res.status(404).json({ success: false });
	try { return pass(res, await agentJSON(`/internal/deal-flow/reach/${req.params.id}`, { user: userOf(req) })); } catch (err) { return sendAgentError(res, err); }
}

// ---- The Something chat (after a review): questions go to Something, a new pitch to a review.
async function chatTurn(req, res) {
	const { text, reviewId, ideaId } = req.body || {};
	if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ success: false, message: 'Write something first' });
	if (text.length > 2000) return res.status(400).json({ success: false, message: 'Keep it under 2000 characters' });
	if (reviewId !== undefined && reviewId !== null && !/^[a-f0-9]{32}$/.test(String(reviewId))) return res.status(400).json({ success: false, message: 'Invalid review' });
	if (ideaId !== undefined && ideaId !== null && !isIdea(ideaId)) return res.status(400).json({ success: false, message: 'Invalid idea' });
	try {
		return pass(res, await agentJSON('/internal/chat', {
			method: 'POST', user: userOf(req), timeoutMs: 30000,
			body: { text: text.slice(0, 2000), ...(reviewId && { reviewId }), ...(ideaId && { ideaId }) },
		}));
	} catch (err) { return sendAgentError(res, err); }
}

async function chatHistory(req, res) {
	const q = /^[a-f0-9]{32}$/.test(String(req.query.reviewId || '')) ? `?reviewId=${req.query.reviewId}` : isIdea(req.query.ideaId) ? `?ideaId=${req.query.ideaId}` : '';
	try { return pass(res, await agentJSON(`/internal/chat${q}`, { user: userOf(req) })); } catch (err) { return sendAgentError(res, err); }
}

module.exports = {
	status, echoStart, echoStream, echoResume, userOf, pass, after, isHex,
	reviewStatus, reviewStart, reviewLatest, reviewGet, reviewStream, reviewReact, reviewDelete,
	dealFlow, dealFlowAct, ideaReach, chatTurn, chatHistory,
};
