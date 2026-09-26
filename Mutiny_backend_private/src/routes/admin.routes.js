const express = require('express');
const router  = express.Router();

const { protect } = require('../middleware/auth.middleware.js');
const { requireAdmin } = require('../middleware/admin.middleware.js');
const { list_verifications, decide_verification } = require('../controllers/admin.controller.js');

// Everything here is admin-only and 404s for anyone else (ADMIN_EMAILS).
router.use(protect, requireAdmin);

router.get('/verifications', list_verifications);
router.post('/verifications/:userId', decide_verification);

module.exports = router;
