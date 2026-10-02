const crypto = require('crypto');

const RESET_TTL_MS = 30 * 60 * 1000;

// Only the sha256 of the token is stored, so a database leak doesn't hand out reset links.
// The token is single-use because the stored hash is cleared when it's redeemed.
const hashResetToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const createResetToken = (ttlMs = RESET_TTL_MS) => {
	const token = crypto.randomBytes(32).toString('base64url');
	return {
		token,
		hash:      hashResetToken(token),
		expiresAt: new Date(Date.now() + ttlMs),
	};
};

module.exports = { createResetToken, hashResetToken, RESET_TTL_MS };
