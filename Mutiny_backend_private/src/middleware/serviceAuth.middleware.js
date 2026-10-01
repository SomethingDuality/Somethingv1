const crypto = require('crypto');

const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();

// Only the agent service may call /internal (it listens on 127.0.0.1 only, too). The key is
// compared in constant time over digests; the previous key is accepted during a rotation.
// Fails closed: with no key configured, nothing gets in.
const requireAgentKey = (req, res, next) => {
	const current = process.env.AGENT_TO_NODE_KEY;
	if (!current) return res.status(503).json({ success: false, message: 'Internal API is not configured' });
	const presented = req.get('x-agent-key');
	if (!presented) return res.status(401).json({ success: false, message: 'Missing service key' });
	const got = digest(presented);
	const ok = crypto.timingSafeEqual(got, digest(current))
		|| (process.env.AGENT_TO_NODE_KEY_PREVIOUS ? crypto.timingSafeEqual(got, digest(process.env.AGENT_TO_NODE_KEY_PREVIOUS)) : false);
	if (!ok) return res.status(401).json({ success: false, message: 'Bad service key' });
	return next();
};

module.exports = { requireAgentKey };
