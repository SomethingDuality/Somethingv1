const express = require('express');
const router  = express.Router();

const {
	get_notifications,
	mark_all_read,
	mark_one_read
} = require('../controllers/notifications.controller.js');

const { protect } = require('../middleware/auth.middleware.js');

router.use(protect);

router.get('/', get_notifications);


router.post('/mark-all-read', mark_all_read);


router.post('/mark-read/:id', mark_one_read);

module.exports = router;
