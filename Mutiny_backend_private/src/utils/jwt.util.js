const jwt = require('jsonwebtoken');

const ACCESS_SECRET  = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;


const ACCESS_EXPIRY  = '15m';
const REFRESH_EXPIRY = '7d';


const generateAccessToken = (user, sid) => {
	return jwt.sign(
		{ _id: user._id, role: user.role, ...(sid && { sid }) },
		ACCESS_SECRET,
		{ expiresIn: ACCESS_EXPIRY }
	);
};


const generateRefreshToken = (user, sid) => {
	return jwt.sign(
		{ _id: user._id, sid, jti: require('crypto').randomBytes(8).toString('hex') },
		REFRESH_SECRET,
		{ expiresIn: REFRESH_EXPIRY }
	);
};




const verifyAccessToken = (token) => {
	return jwt.verify(token, ACCESS_SECRET);
};


const verifyRefreshToken = (token) => {
	return jwt.verify(token, REFRESH_SECRET);
};


module.exports = {
	generateAccessToken,
	generateRefreshToken,
	verifyAccessToken,
	verifyRefreshToken,
	ACCESS_EXPIRY,
	REFRESH_EXPIRY,
};
