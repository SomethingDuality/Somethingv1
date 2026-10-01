const express = require('express');
const multer  = require('multer');
const path    = require('path');
const router  = express.Router();

const { get_profile, update_profile, update_avatar, get_overview, get_funding } = require('../controllers/founder.controller.js');
const { protect } = require('../middleware/auth.middleware.js');
const { overlaps, get_waitlist, join_waitlist, leave_waitlist } = require('../controllers/review.controller.js');
const { make } = require('../middleware/rateLimits.js');

// Comparing against every public idea is the heaviest read a founder can trigger.
const overlapsLimiter = make('overlaps', { windowMs: 60 * 1000, limit: 20, byUser: true });


const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, path.join(__dirname, '../../uploads/avatars'));
	},
	filename: (req, file, cb) => {
		const ext  = path.extname(file.originalname).toLowerCase();
		const name = `${req.user._id}-${Date.now()}${ext}`;
		cb(null, name);
	}
});

const fileFilter = (req, file, cb) => {
	const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
	if (allowed.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(new Error('Only JPEG, PNG, WEBP and GIF images are allowed'), false);
	}
};

const upload = multer({
	storage,
	fileFilter,
	limits: { fileSize: 5 * 1024 * 1024 } 
});


router.use(protect);


router.get('/profile', get_profile);


router.put('/profile', update_profile);


router.post('/avatar', upload.single('avatar'), update_avatar);


router.get('/overview', get_overview);
router.get('/funding',  get_funding);

// The Something page: overlaps work today; the AI review has a waitlist until it ships (F8).
router.post('/overlaps',          overlapsLimiter, overlaps);
router.get('/review-waitlist',    get_waitlist);
router.post('/review-waitlist',   join_waitlist);
router.delete('/review-waitlist', leave_waitlist);

module.exports = router;
