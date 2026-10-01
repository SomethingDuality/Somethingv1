const express = require('express');
const router  = express.Router();

const { getNext, answer, skip, progress, rest } = require('../controllers/questions.controller.js');
const { protect } = require('../middleware/auth.middleware.js');
const { make } = require('../middleware/rateLimits.js');

router.use(protect);

const answerLimiter = make('questions', { windowMs: 60 * 1000, limit: 30, byUser: true });

// The Something box: one optional question at a time.
router.get('/next', getNext);
router.post('/:id/answer', answerLimiter, answer);
router.post('/:id/skip', answerLimiter, skip);
router.get('/progress', progress);
router.post('/rest', answerLimiter, rest);

module.exports = router;
