const express = require('express');
const router  = express.Router();

const { protect } = require('../middleware/auth.middleware.js');
const { requireAdmin } = require('../middleware/admin.middleware.js');
const { list_verifications, decide_verification } = require('../controllers/admin.controller.js');
const { moderation_queue, moderation_action } = require('../controllers/reports.controller.js');

// Everything here is admin-only and 404s for anyone else (ADMIN_EMAILS).
router.use(protect, requireAdmin);

router.get('/verifications', list_verifications);
router.post('/verifications/:userId', decide_verification);

// Community moderation (C1): hidden, reported and flagged items, and what to do with them.
router.get('/moderation', moderation_queue);
router.post('/moderation/:type/:id', moderation_action);

module.exports = router;
