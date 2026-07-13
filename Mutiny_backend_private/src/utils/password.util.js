const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

const hashPassword = async (password) => {
	try {
		return await bcrypt.hash(password, SALT_ROUNDS);
	} catch (err) {
		console.error('hashPassword error:', err);
		throw err;
	}
};

const comparePasswords = async (password, hashedPassword) => {
	return bcrypt.compare(password, hashedPassword);
};

module.exports = {
	hashPassword,
	comparePasswords
};
