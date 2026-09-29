const express = require('express');
const router  = express.Router();

const { protect } = require('../middleware/auth.middleware.js');
const { inbox_summary } = require('../controllers/notifications.controller.js');

router.use(protect);

// Polled by the app shell for its badges (notifications now; chats in community C5).
router.get('/summary', inbox_summary);

module.exports = router;
