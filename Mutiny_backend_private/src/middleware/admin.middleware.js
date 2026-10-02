const { BaseUser } = require('../models/user.model.js');

// Admins are listed by email in ADMIN_EMAILS (comma separated). Somay adds his own address to
// .env; no email is ever written into the code. Anyone else gets the same 404 as a missing route.
const adminEmails = () =>
	String(process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const isAdminEmail = (email) => Boolean(email) && adminEmails().includes(String(email).toLowerCase());

// An address on the list is not enough: the account must have proved it owns it (anyone could
// sign up with an admin's address before the admin does).
const isAdmin = (user) => Boolean(user?.emailVerified) && isAdminEmail(user?.email);

// Runs after `protect`.
const requireAdmin = async (req, res, next) => {
	try {
		const user = await BaseUser.findById(req.user._id).select('email emailVerified').lean();
		if (!isAdmin(user)) return res.status(404).json({ success: false, message: 'Not found' });
		next();
	} catch (err) {
		console.error('requireAdmin:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

module.exports = { isAdminEmail, isAdmin, requireAdmin, adminEmails };
