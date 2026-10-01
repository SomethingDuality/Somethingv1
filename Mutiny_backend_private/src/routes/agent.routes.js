const express = require('express');
const { protect, requireRole } = require('../middleware/auth.middleware.js');
const { make } = require('../middleware/rateLimits.js');
const agent = require('../controllers/agent.controller.js');

const router = express.Router();
const burst = make('agent-burst', { windowMs: 60 * 1000, limit: 10, byUser: true });

router.get('/status', protect, agent.status);

// Reviews: founders only (R9). Burst limits here; the daily quota (R7) is the agent's.
const founder = [protect, requireRole('Founder')];
router.get('/reviews/status', ...founder, agent.reviewStatus);
router.post('/reviews', ...founder, burst, agent.reviewStart);
router.get('/reviews/latest', ...founder, agent.reviewLatest);
router.get('/reviews/:id', ...founder, agent.reviewGet);
router.get('/reviews/:id/stream', ...founder, agent.reviewStream);
router.post('/reviews/:id/react', ...founder, burst, agent.reviewReact);
router.delete('/reviews/:id', ...founder, agent.reviewDelete);

// Matched deal flow, every 7 days: investors and founders both get one.
router.get('/deal-flow', protect, agent.dealFlow);
router.post('/deal-flow/:id', protect, burst, agent.dealFlowAct);
router.get('/ideas/:id/reach', ...founder, agent.ideaReach);

// The Something chat (founders; the agent caps replies per day).
router.post('/chat', ...founder, burst, agent.chatTurn);
router.get('/chat', ...founder, agent.chatHistory);

if (process.env.NODE_ENV !== 'production') {
	router.post('/diagnostics/echo', protect, burst, agent.echoStart);
	router.get('/diagnostics/echo/:id/stream', protect, agent.echoStream);
	router.post('/diagnostics/echo/:id/resume', protect, burst, agent.echoResume);
}

module.exports = router;
