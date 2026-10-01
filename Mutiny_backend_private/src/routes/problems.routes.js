const express = require('express');
const router  = express.Router();

const { protect, optionalAuth } = require('../middleware/auth.middleware.js');
const { make } = require('../middleware/rateLimits.js');
const {
	list_problems, get_problem, create_problem, delete_problem, vote_problem, trending_tags,
	list_replies, add_reply, delete_reply,
} = require('../controllers/problems.controller.js');

// Community plan C3: problems 5/hour and 20/day, votes 60/min, replies 20 per 10 min.
const problemsHourly = make('problems-hour', { windowMs: 60 * 60 * 1000, limit: 5, byUser: true });
const problemsDaily  = make('problems-day',  { windowMs: 24 * 60 * 60 * 1000, limit: 20, byUser: true });
const voteLimiter    = make('votes',         { windowMs: 60 * 1000, limit: 60, byUser: true });
const replyLimiter   = make('replies',       { windowMs: 10 * 60 * 1000, limit: 20, byUser: true });

router.get('/',                      optionalAuth, list_problems);
router.get('/trending-tags',         trending_tags);
router.post('/',                     protect, problemsHourly, problemsDaily, create_problem);
router.delete('/comments/:commentId', protect, delete_reply);
router.get('/:id',                   optionalAuth, get_problem);
router.delete('/:id',                protect, delete_problem);
router.put('/:id/vote',              protect, voteLimiter, vote_problem);
router.get('/:id/comments',          optionalAuth, list_replies);
router.post('/:id/comments',         protect, replyLimiter, add_reply);

module.exports = router;
