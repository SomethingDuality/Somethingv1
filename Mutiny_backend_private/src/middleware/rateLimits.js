const { rateLimit } = require('express-rate-limit');

// RATE_LIMIT_MULTIPLIER lets tests relax limits without editing them.
const MULT = Math.max(1, Number(process.env.RATE_LIMIT_MULTIPLIER) || 1);

const make = (name, { windowMs, limit, byUser = false }) => rateLimit({
	windowMs,
	limit: limit * MULT,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	// Signed-in actions are limited per account; anonymous ones (login, signup) per IP.
	keyGenerator: byUser
		? (req) => `${name}:${req.user?._id || req.ip}`
		: (req) => `${name}:${req.ip}`,
	handler: (req, res, _next, options) => res.status(429).json({
		success: false,
		code: 'RATE_LIMITED',
		message: 'Too many attempts. Please wait a bit and try again.',
		retryAfter: Math.ceil(options.windowMs / 1000),
	}),
});

module.exports = {
	loginLimiter:          make('login',  { windowMs: 15 * 60 * 1000, limit: 10 }),
	signupLimiter:         make('signup', { windowMs: 60 * 60 * 1000, limit: 10 }),
	forgotPasswordLimiter: make('forgot', { windowMs: 60 * 60 * 1000, limit: 5 }),
	resetPasswordLimiter:  make('reset',  { windowMs: 60 * 60 * 1000, limit: 10 }),
	googleAuthLimiter:     make('google', { windowMs: 15 * 60 * 1000, limit: 20 }),
	changePasswordLimiter: make('change-password', { windowMs: 60 * 60 * 1000, limit: 10, byUser: true }),
	// New chat requests, however they start (POST /threads or "Collaborate" on an idea): one count.
	chatRequestLimiter:    make('chat-requests', { windowMs: 24 * 60 * 60 * 1000, limit: 10, byUser: true }),
	make,
};
