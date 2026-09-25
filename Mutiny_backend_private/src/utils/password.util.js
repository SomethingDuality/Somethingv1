const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;
const MIN_LENGTH  = 8;
const MAX_BYTES   = 72; // bcrypt ignores everything after 72 bytes

const hashPassword = async (password) => {
	try {
		return await bcrypt.hash(password, SALT_ROUNDS);
	} catch (err) {
		console.error('hashPassword error:', err);
		throw err;
	}
};

const comparePasswords = async (password, hashedPassword) => {
	if (!hashedPassword) return false; // Google-only accounts have no password
	return bcrypt.compare(password, hashedPassword);
};

// One policy for signup, reset and change (NIST 800-63B style): length matters,
// composition rules don't. Returns an error message, or null when the password is fine.
const validatePassword = (password, { email } = {}) => {
	if (typeof password !== 'string' || password.length < MIN_LENGTH) {
		return `Password must be at least ${MIN_LENGTH} characters`;
	}
	if (Buffer.byteLength(password, 'utf8') > MAX_BYTES) {
		return `Password must be at most ${MAX_BYTES} bytes`;
	}
	if (email && password.toLowerCase() === String(email).toLowerCase()) {
		return 'Password must not be your email address';
	}
	return null;
};

module.exports = {
	hashPassword,
	comparePasswords,
	validatePassword,
};
