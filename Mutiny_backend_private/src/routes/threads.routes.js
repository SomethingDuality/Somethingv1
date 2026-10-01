const express = require('express');
const router  = express.Router();

const { protect } = require('../middleware/auth.middleware.js');
const { make } = require('../middleware/rateLimits.js');
const c = require('../controllers/threads.controller.js');

// Community plan C5: chat requests 10/day (plus at most 20 waiting, in the service), messages 30/min.
const requestLimiter = make('chat-requests', { windowMs: 24 * 60 * 60 * 1000, limit: 10, byUser: true });
const messageLimiter = make('chat-messages', { windowMs: 60 * 1000, limit: 30, byUser: true });

router.use(protect);

router.get('/',               c.list_threads);
router.post('/',              requestLimiter, c.start_thread);
router.get('/:id',            c.get_thread);
router.get('/:id/messages',   c.list_messages);
router.post('/:id/messages',  messageLimiter, c.send_message);
router.post('/:id/accept',    c.accept);
router.post('/:id/decline',   c.decline);
router.post('/:id/read',      c.read);
router.post('/:id/reveal',    c.reveal);
router.post('/:id/block',     c.block);

module.exports = router;
