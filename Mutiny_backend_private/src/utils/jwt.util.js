const jwt = require('jsonwebtoken');

const ACCESS_SECRET  = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;



const RESET_SECRET   = process.env.RESET_TOKEN_SECRET || ACCESS_SECRET + '_reset';

const ACCESS_EXPIRY  = '15m';
const REFRESH_EXPIRY = '7d';
const RESET_EXPIRY   = '15m';


const generateAccessToken = (user) => {
	return jwt.sign(
		{ _id: user._id, role: user.role },
		ACCESS_SECRET,
		{ expiresIn: ACCESS_EXPIRY }
	);
};


const generateRefreshToken = (user) => {
	return jwt.sign(
		{ _id: user._id },
		REFRESH_SECRET,
		{ expiresIn: REFRESH_EXPIRY }
	);
};




const generateResetToken = (user) => {
	return jwt.sign(
		{ _id: user._id, pwHash: user.password },
		RESET_SECRET,
		{ expiresIn: RESET_EXPIRY }
	);
};


const verifyAccessToken = (token) => {
	return jwt.verify(token, ACCESS_SECRET);
};


const verifyRefreshToken = (token) => {
	return jwt.verify(token, REFRESH_SECRET);
};


const verifyResetToken = (token) => {
	return jwt.verify(token, RESET_SECRET);
};

module.exports = {
	generateAccessToken,
	generateRefreshToken,
	generateResetToken,
	verifyAccessToken,
	verifyRefreshToken,
	verifyResetToken,
	ACCESS_EXPIRY,
	REFRESH_EXPIRY,
	RESET_EXPIRY,
};
