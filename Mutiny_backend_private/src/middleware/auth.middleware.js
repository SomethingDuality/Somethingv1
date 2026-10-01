const { verifyAccessToken } = require('../utils/jwt.util.js');


const protect = (req, res, next) => {
	const token = req.cookies?.accessToken;

	if (!token) {
		console.log('[PROTECT] ❌ No accessToken cookie — returning 401');
		return res.status(401).json({
			success: false,
			message: 'Not authenticated — access token missing'
		});
	}

	try {
		const decoded = verifyAccessToken(token);
		req.user = decoded;
		next();
	} catch (err) {
		return res.status(401).json({
			success: false,
			message: 'Access token invalid or expired'
		});
	}
};


// For public routes that show more to the right person (e.g. a draft to its owner):
// sets req.user when a valid access token is present, and never rejects.
const optionalAuth = (req, res, next) => {
	const token = req.cookies?.accessToken;
	if (token) {
		try {
			req.user = verifyAccessToken(token);
		} catch {
			// expired or invalid: treat as anonymous
		}
	}
	next();
};


const requireRole = (role) => (req, res, next) => {
	if (!req.user || req.user.role !== role) {
		return res.status(403).json({
			success: false,
			message: `Access restricted to ${role} accounts`
		});
	}
	next();
};

module.exports = { protect, optionalAuth, requireRole };
