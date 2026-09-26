const express = require('express');
const multer  = require('multer');
const path    = require('path');
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
} = require('../controllers/investor.controller.js');

const {
	commit,
	get_portfolio,
	withdraw,
	release
} = require('../controllers/portfolio.controller.js');

const { protect } = require('../middleware/auth.middleware.js');

const storage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads/avatars')),
	filename:    (req, file, cb) => cb(null, `${req.user._id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
	storage,
	fileFilter: (req, file, cb) => {
		const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
		allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Images only'), false);
	},
	limits: { fileSize: 5 * 1024 * 1024 }
});


router.use(protect);

router.get('/profile',            get_profile);
router.put('/profile',            update_profile);
router.put('/preferences',        update_preferences);
router.put('/interests',          update_interests);
router.put('/visibility',         update_visibility);
router.get('/watchlist',                 get_watchlist);
router.post('/watchlist/:ideaId',        save_idea);
router.delete('/watchlist/:ideaId',      unsave_idea);
router.post('/avatar',            upload.single('avatar'), update_avatar);


router.post('/commit',                              commit);
router.get('/portfolio',                            get_portfolio);
router.post('/portfolio/:investmentId/release',     release);
router.delete('/portfolio/:investmentId',           withdraw);

module.exports = router;
