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


const requireRole = (role) => (req, res, next) => {
	if (!req.user || req.user.role !== role) {
		return res.status(403).json({
			success: false,
			message: `Access restricted to ${role} accounts`
		});
	}
	next();
};

module.exports = { protect, requireRole };
