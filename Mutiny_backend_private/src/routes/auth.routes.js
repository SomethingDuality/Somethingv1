const express = require('express');
const router  = express.Router();

const {
	signup, login, me, logout, refresh,
	forgot_password, reset_password, change_password, google_auth, delete_account,
} = require('../controllers/user.controller.js');
const { protect } = require('../middleware/auth.middleware.js');
const limits = require('../middleware/rateLimits.js');


router.post('/signup', limits.signupLimiter, signup);

router.post('/login', limits.loginLimiter, login);

router.post('/google', limits.googleAuthLimiter, google_auth);

router.get('/me', protect, me);

router.post('/refresh', refresh);

router.post('/logout', logout);

// Emails a single-use reset link; never returns a token.
router.post('/forgot-password', limits.forgotPasswordLimiter, forgot_password);

router.post('/reset-password', limits.resetPasswordLimiter, reset_password);

router.post('/change-password', protect, limits.changePasswordLimiter, change_password);

router.delete('/account', protect, delete_account);

module.exports = router;
