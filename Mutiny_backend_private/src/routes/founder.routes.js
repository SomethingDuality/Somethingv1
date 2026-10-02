const express = require('express');
const multer  = require('multer');
const uploads = require('../utils/uploads.js');
const router  = express.Router();

const { get_profile, update_profile, update_avatar, get_overview, get_funding } = require('../controllers/founder.controller.js');
const { protect } = require('../middleware/auth.middleware.js');
const { overlaps, get_waitlist, join_waitlist, leave_waitlist } = require('../controllers/review.controller.js');
const { make } = require('../middleware/rateLimits.js');

// Comparing against every public idea is the heaviest read a founder can trigger.
const overlapsLimiter = make('overlaps', { windowMs: 60 * 1000, limit: 20, byUser: true });


// Avatars: random names with our own extension, contents checked (X-7); see utils/uploads.js.
const upload = multer({
	storage: multer.diskStorage({
		destination: uploads.avatarDestination,
		filename: uploads.filenameFor(uploads.AVATAR_TYPES),
	}),
	fileFilter: uploads.filterFor(uploads.AVATAR_TYPES, 'Only JPEG, PNG, WEBP and GIF images are allowed'),
	limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});


router.use(protect);


router.get('/profile', get_profile);


router.put('/profile', update_profile);


router.post('/avatar', upload.single('avatar'), uploads.checkMagic(uploads.AVATAR_TYPES), update_avatar);


router.get('/overview', get_overview);
router.get('/funding',  get_funding);

// The Something page: overlaps work today; the AI review has a waitlist until it ships (F8).
router.post('/overlaps',          overlapsLimiter, overlaps);
router.get('/review-waitlist',    get_waitlist);
router.post('/review-waitlist',   join_waitlist);
router.delete('/review-waitlist', leave_waitlist);

module.exports = router;
