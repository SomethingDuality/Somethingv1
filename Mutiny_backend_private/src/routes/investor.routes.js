const express = require('express');
const multer  = require('multer');
const uploads = require('../utils/uploads.js');
const router  = express.Router();

const {
	get_profile,
	update_profile,
	update_preferences,
	update_interests,
	update_visibility,
	update_avatar,
	get_watchlist,
	save_idea,
	unsave_idea,
	submit_verification,
	update_ghost_mode,
} = require('../controllers/investor.controller.js');

const {
	commit,
	get_portfolio,
	withdraw,
	release
} = require('../controllers/portfolio.controller.js');

const { protect } = require('../middleware/auth.middleware.js');

// Avatars: random names with our own extension, contents checked (X-7); see utils/uploads.js.
const upload = multer({
	storage: multer.diskStorage({
		destination: (req, file, cb) => cb(null, uploads.AVATARS_DIR),
		filename: uploads.filenameFor(uploads.AVATAR_TYPES),
	}),
	fileFilter: uploads.filterFor(uploads.AVATAR_TYPES, 'Images only'),
	limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});


router.use(protect);

router.get('/profile',            get_profile);
router.put('/profile',            update_profile);
router.put('/preferences',        update_preferences);
router.put('/interests',          update_interests);
router.put('/visibility',         update_visibility);
router.post('/verification',             submit_verification);
router.put('/ghost-mode',                update_ghost_mode);
router.get('/watchlist',                 get_watchlist);
router.post('/watchlist/:ideaId',        save_idea);
router.delete('/watchlist/:ideaId',      unsave_idea);
router.post('/avatar',            upload.single('avatar'), uploads.checkMagic(uploads.AVATAR_TYPES), update_avatar);


router.post('/commit',                              commit);
router.get('/portfolio',                            get_portfolio);
router.post('/portfolio/:investmentId/release',     release);
router.delete('/portfolio/:investmentId',           withdraw);

module.exports = router;
