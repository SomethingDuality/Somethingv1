const { BaseUser, Founder, Investor } = require('../models/user.model.js');
const { hashPassword, comparePasswords, validatePassword } = require('../utils/password.util.js');
const {
	generateAccessToken,
	generateRefreshToken,
	verifyAccessToken,
	verifyRefreshToken,
} = require('../utils/jwt.util.js');
const { createResetToken, hashResetToken } = require('../utils/resetToken.util.js');
const mailer = require('../utils/mailer.js');
const google = require('../auth/google.js');
const crypto = require('crypto');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 100;

const REFRESH_COOKIE_OPTS = {
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
	maxAge: 7 * 24 * 60 * 60 * 1000 
};

const ACCESS_COOKIE_OPTS = {
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
	maxAge: 15 * 60 * 1000 
};

const publicUser = (user) => ({
	_id:  user._id,
	name: user.name,
	email: user.email,
	role: user.role,
	plan: user.plan,
});

const MAX_SESSIONS = 10;           // devices signed in at once; the oldest goes first
const REFRESH_GRACE_MS = 30 * 1000; // a tab that raced another tab's rotation still gets through
const sha256 = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

// Starts a new session for this device: its own refresh token, stored as a hash (X-47). Signing
// in elsewhere never signs this device out.
const startSession = async (res, user) => {
	const sid = crypto.randomBytes(12).toString('hex');
	const refreshToken = generateRefreshToken(user, sid);
	const now = new Date();
	await BaseUser.updateOne({ _id: user._id }, { $push: { sessions: {
		$each: [{ sid, hash: sha256(refreshToken), prevHash: null, rotatedAt: now, createdAt: now }], $slice: -MAX_SESSIONS,
	} } });
	res.cookie('accessToken',  generateAccessToken(user, sid), ACCESS_COOKIE_OPTS);
	res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);
	return sid;
};

// The session id from either cookie (expired tokens included: logging out must still work).
const sessionIdOf = (req) => {
	for (const [name, verify] of [['refreshToken', verifyRefreshToken], ['accessToken', verifyAccessToken]]) {
		const token = req.cookies?.[name];
		if (!token) continue;
		try {
			const d = verify(token);
			if (d?.sid) return { userId: d._id, sid: d.sid };
		} catch {
			const d = require('jsonwebtoken').decode(token);
			if (d?.sid && d?._id) return { userId: d._id, sid: d.sid };
		}
	}
	return null;
};

// Emails a link that proves the address is theirs (24 h, single use).
const sendVerification = async (user) => {
	const { token, hash, expiresAt } = createResetToken(24 * 60 * 60 * 1000);
	await BaseUser.updateOne({ _id: user._id }, { $set: { emailVerifyTokenHash: hash, emailVerifyExpires: expiresAt } });
	const base = process.env.APP_BASE_URL || 'http://localhost:3000';
	await mailer.sendEmailVerification(user.email, `${base}/verify?token=${encodeURIComponent(token)}`);
};

const normalizeRole = (role) => {
	const r = String(role || '').toLowerCase();
	return r === 'founder' || r === 'investor' ? r : null;
};


// Minimal signup: name, email, password, role, terms. Everything else is asked later, one
// optional question at a time, by the Something box. `plan` is never read from the client.
const signup = async (req, res) => {
	const { name, email, password, role, accepted_terms } = req.body || {};

	const cleanName  = typeof name === 'string' ? name.trim() : '';
	const cleanEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';
	const cleanRole  = normalizeRole(role);

	if (!cleanName || !cleanEmail || !password || !role) {
		return res.status(400).json({ success: false, message: 'name, email, password and role are required' });
	}
	if (cleanName.length > MAX_NAME) {
		return res.status(400).json({ success: false, message: `Name must be at most ${MAX_NAME} characters` });
	}
	if (!EMAIL_RE.test(cleanEmail)) {
		return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
	}
	if (!cleanRole) {
		return res.status(400).json({ success: false, message: 'role must be either "founder" or "investor"' });
	}
	const pwError = validatePassword(password, { email: cleanEmail });
	if (pwError) {
		return res.status(400).json({ success: false, message: pwError });
	}
	if (!accepted_terms) {
		return res.status(400).json({ success: false, message: 'You must accept the terms and conditions' });
	}

	try {
		const existing = await BaseUser.findOne({ email: cleanEmail }).select('_id').lean();
		if (existing) {
			return res.status(409).json({ success: false, message: 'An account with this email already exists' });
		}

		const Model = cleanRole === 'founder' ? Founder : Investor;
		const newUser = await Model.create({
			name:           cleanName,
			email:          cleanEmail,
			password:       await hashPassword(password),
			plan:           'free',
			accepted_terms: true,
			authProviders:  ['password'],
		});

		await startSession(res, newUser);
		await sendVerification(newUser).catch((err) => console.error('[SIGNUP] verification email:', err.message));

		return res.status(201).json({ success: true, message: 'Account created successfully', user: publicUser(newUser) });
	} catch (err) {
		if (err && err.code === 11000) {
			return res.status(409).json({ success: false, message: 'An account with this email already exists' });
		}
		console.error('[SIGNUP] error:', err);
		return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
	}
};

const login = async (req, res) => {
	let { email, password } = req.body || {};

	if (!email || !password || typeof password !== 'string') {
		return res.status(400).json({ success: false, message: 'Email and password are required' });
	}

	email = String(email).toLowerCase().trim();

	try {
		const user = await BaseUser.findOne({ email });
		if (!user) {
			return res.status(401).json({ success: false, message: 'Invalid credentials' });
		}

		if (!user.password) {
			return res.status(401).json({ success: false, code: 'GOOGLE_ONLY', message: 'This account uses Continue with Google' });
		}

		const valid = await comparePasswords(password, user.password);
		if (!valid) {
			return res.status(401).json({ success: false, message: 'Invalid credentials' });
		}

		await startSession(res, user);

		return res.status(200).json({ success: true, message: 'Logged in successfully', user: publicUser(user) });
	} catch (err) {
		console.error('[LOGIN] error:', err.message);
		return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
	}
};

const me = async (req, res) => {
	try {
		const user = await BaseUser.findById(req.user._id).lean();
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}
		return res.status(200).json({
			id:            user._id,
			name:          user.name,
			email:         user.email,
			role:          user.role,
			plan:          user.plan,
			avatarUrl:     user.avatar || null,
			hasPassword:   Boolean(user.password),
			emailVerified: Boolean(user.emailVerified),
			isAdmin:       require('../middleware/admin.middleware.js').isAdmin(user),
			authProviders: user.authProviders?.length ? user.authProviders : ['password'],
			// Investors only: Ghost Mode is on unless they turned it off (C5).
			...(user.role === 'Investor' && { ghostMode: user.ghostMode !== false }),
		});
	} catch (err) {
		console.error('[ME] 💥 Error:', err.message);
		return res.status(500).json({ success: false, message: 'Something went wrong' });
	}
};


// Ends this device's session only; other devices stay signed in.
const logout = async (req, res) => {
	const CLEAR_OPTS = {
		httpOnly: true,
		secure:   process.env.NODE_ENV === 'production',
		sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
	};
	const session = sessionIdOf(req);
	if (!session && !req.cookies?.accessToken && !req.cookies?.refreshToken) {
		return res.status(400).json({ success: false, message: 'No active session found' });
	}
	try {
		if (session) await BaseUser.updateOne({ _id: session.userId }, { $pull: { sessions: { sid: session.sid } } });
		return res.status(200).json({ success: true, message: 'Logged out successfully' });
	} catch (err) {
		console.error('logout error:', err);
		return res.status(500).json({ success: false, message: 'Logout encountered an error, but session has been cleared' });
	} finally {
		res.clearCookie('accessToken',  CLEAR_OPTS);
		res.clearCookie('refreshToken', CLEAR_OPTS);
	}
};

// One-click sign-in as a test account, for local development only. Both switches are read on
// every request, so a production server answers 404 even if DEV_LOGIN leaks into its env.
const devLoginEnabled = () => process.env.NODE_ENV !== 'production' && process.env.DEV_LOGIN === 'true';

const dev_login_status = async (req, res) => {
	if (!devLoginEnabled()) return res.status(404).json({ success: false, message: 'Not found' });
	try {
		const { TEST_ACCOUNTS } = require('../dev/testAccounts.js');
		const found = await BaseUser.find({ email: { $in: TEST_ACCOUNTS.map((a) => a.email) } }).select('name email role').lean();
		const accounts = found.map((u) => ({ role: u.role.toLowerCase(), name: u.name, email: u.email }));
		return res.status(200).json({ accounts });
	} catch (err) {
		console.error('[DEV_LOGIN] status error:', err.message);
		return res.status(500).json({ success: false, message: 'Something went wrong' });
	}
};

const dev_login = async (req, res) => {
	if (!devLoginEnabled()) return res.status(404).json({ success: false, message: 'Not found' });
	const role = normalizeRole(req.body?.role);
	if (!role) return res.status(400).json({ success: false, message: 'role must be founder or investor' });
	try {
		const { TEST_ACCOUNTS } = require('../dev/testAccounts.js');
		const account = TEST_ACCOUNTS.find((a) => a.role.toLowerCase() === role);
		const user = await BaseUser.findOne({ email: account.email });
		if (!user) {
			return res.status(404).json({ success: false, message: `No test ${role} in this database. Start the API with npm run dev:memory.` });
		}
		await startSession(res, user);
		return res.status(200).json({ success: true, user: publicUser(user) });
	} catch (err) {
		console.error('[DEV_LOGIN] error:', err.message);
		return res.status(500).json({ success: false, message: 'Something went wrong' });
	}
};

module.exports = {
	signup,
	login,
	me,
	logout,
	refresh,
	forgot_password,
	reset_password,
	change_password,
	google_auth,
	delete_account,
	dev_login_status,
	dev_login,
	verify_email,
	resend_verification,
};




// Rotates this device's refresh token. A token that was just rotated by another tab (within
// REFRESH_GRACE_MS) gets a new access token and leaves the refresh cookie alone; any other old
// token means reuse, and only this device's session ends (X-47: it used to end every session).
async function refresh(req, res) {
	const CLEAR_OPTS = {
		httpOnly: true,
		secure:   process.env.NODE_ENV === 'production',
		sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
	};
	const denied = (message) => {
		res.clearCookie('accessToken',  CLEAR_OPTS);
		res.clearCookie('refreshToken', CLEAR_OPTS);
		return res.status(401).json({ success: false, message });
	};
	const refreshToken = req.cookies?.refreshToken;
	if (!refreshToken) {
		return res.status(401).json({ success: false, message: 'No refresh token — please log in again' });
	}

	try {
		let decoded;
		try {
			decoded = verifyRefreshToken(refreshToken);
		} catch {
			return denied('Refresh token invalid or expired — please log in again');
		}
		if (!decoded.sid) return denied('Please log in again');

		const user = await BaseUser.findById(decoded._id).select('_id role +sessions').lean();
		const session = user?.sessions?.find((x) => x.sid === decoded.sid);
		if (!session) return denied('This session has ended — please log in again');

		const hash = sha256(refreshToken);
		if (hash === session.hash) {
			const next = generateRefreshToken(user, decoded.sid);
			// Conditional on the hash: of two refreshes at once, exactly one rotates.
			const won = await BaseUser.updateOne(
				{ _id: user._id, sessions: { $elemMatch: { sid: decoded.sid, hash } } },
				{ $set: { 'sessions.$.hash': sha256(next), 'sessions.$.prevHash': hash, 'sessions.$.rotatedAt': new Date() } },
			);
			if (won.matchedCount) {
				res.cookie('accessToken',  generateAccessToken(user, decoded.sid), ACCESS_COOKIE_OPTS);
				res.cookie('refreshToken', next, REFRESH_COOKIE_OPTS);
				return res.status(200).json({ success: true });
			}
			const fresh = await BaseUser.findById(user._id).select('+sessions').lean();
			Object.assign(session, fresh?.sessions?.find((x) => x.sid === decoded.sid) || { prevHash: null });
		}
		if (hash === session.prevHash && Date.now() - new Date(session.rotatedAt).getTime() < REFRESH_GRACE_MS) {
			res.cookie('accessToken', generateAccessToken(user, decoded.sid), ACCESS_COOKIE_OPTS);
			return res.status(200).json({ success: true });
		}
		await BaseUser.updateOne({ _id: user._id }, { $pull: { sessions: { sid: decoded.sid } } });
		return denied('This sign-in was used somewhere else, so it was ended. Please log in again.');
	} catch (err) {
		console.error('refresh error:', err);
		return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
	}
}





// Always answers the same way, whether or not the account exists (no user enumeration).
// The reset link is emailed; the token is never returned to the client.
// POST /auth/verify-email { token }: the link from the signup email.
async function verify_email(req, res) {
	const token = typeof req.body?.token === 'string' ? req.body.token : '';
	if (!token) return res.status(400).json({ success: false, message: 'This link is incomplete' });
	try {
		const done = await BaseUser.findOneAndUpdate(
			{ emailVerifyTokenHash: hashResetToken(token), emailVerifyExpires: { $gt: new Date() } },
			{ $set: { emailVerified: true }, $unset: { emailVerifyTokenHash: '', emailVerifyExpires: '' } },
		);
		if (!done) return res.status(400).json({ success: false, message: 'This link is invalid or has expired' });
		return res.status(200).json({ success: true, message: 'Email verified' });
	} catch (err) {
		console.error('verify_email error:', err);
		return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
	}
}

// POST /auth/verify-email/resend (signed in): a new link, for whoever lost the first one.
async function resend_verification(req, res) {
	try {
		const user = await BaseUser.findById(req.user._id).select('email emailVerified').lean();
		if (!user) return res.status(404).json({ success: false, message: 'User not found' });
		if (user.emailVerified) return res.status(200).json({ success: true, message: 'Your email is already verified' });
		await sendVerification(user);
		return res.status(200).json({ success: true, message: 'We sent a new link' });
	} catch (err) {
		console.error('resend_verification error:', err);
		return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
	}
}


async function forgot_password(req, res) {
	const { email } = req.body || {};

	if (!email) {
		return res.status(400).json({ success: false, message: 'Email is required' });
	}

	const GENERIC = { success: true, message: 'If an account with that email exists, we sent a reset link.' };

	try {
		const user = await BaseUser.findOne({ email: String(email).toLowerCase().trim() }).select('_id email');
		if (!user) return res.status(200).json(GENERIC);

		const { token, hash, expiresAt } = createResetToken();
		await BaseUser.updateOne(
			{ _id: user._id },
			{ $set: { passwordResetTokenHash: hash, passwordResetExpires: expiresAt } }
		);

		const base = process.env.APP_BASE_URL || 'http://localhost:3000';
		await mailer.sendPasswordReset(user.email, `${base}/reset?token=${encodeURIComponent(token)}`);

		return res.status(200).json(GENERIC);
	} catch (err) {
		console.error('forgot_password error:', err);
		return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
	}
}


async function reset_password(req, res) {
	const { token, newPassword } = req.body || {};

	if (!token || !newPassword) {
		return res.status(400).json({ success: false, message: 'token and newPassword are required' });
	}

	try {
		const user = await BaseUser.findOne({
			passwordResetTokenHash: hashResetToken(token),
			passwordResetExpires:   { $gt: new Date() },
		}).select('_id email password authProviders');

		if (!user) {
			return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired' });
		}

		const pwError = validatePassword(newPassword, { email: user.email });
		if (pwError) {
			return res.status(400).json({ success: false, message: pwError });
		}

		// Single use: clearing the hash makes the same link fail next time. Every session ends; the
		// link proved the email, so it's verified too.
		await BaseUser.updateOne(
			{ _id: user._id },
			{
				$set:      { password: await hashPassword(newPassword), sessions: [], emailVerified: true },
				$unset:    { passwordResetTokenHash: '', passwordResetExpires: '' },
				$addToSet: { authProviders: 'password' },
			}
		);

		return res.status(200).json({ success: true, message: 'Password reset. Please log in with your new password.' });
	} catch (err) {
		console.error('reset_password error:', err);
		return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
	}
}


// Signed-in password change. The current password is required whenever one exists;
// Google-only accounts can set a first password without one.
async function change_password(req, res) {
	const { currentPassword, newPassword } = req.body || {};

	try {
		const user = await BaseUser.findById(req.user._id).select('_id email password role');
		if (!user) return res.status(404).json({ success: false, message: 'User not found' });

		if (user.password) {
			const ok = await comparePasswords(String(currentPassword || ''), user.password);
			// 400, not 401: a 401 makes the app refresh the session and send it again.
			if (!ok) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
			if (await comparePasswords(String(newPassword || ''), user.password)) {
				return res.status(400).json({ success: false, message: 'New password must be different from the current one' });
			}
		}

		const pwError = validatePassword(newPassword, { email: user.email });
		if (pwError) return res.status(400).json({ success: false, message: pwError });

		// Other devices are signed out; this one starts a fresh session and stays in.
		await BaseUser.updateOne(
			{ _id: user._id },
			{ $set: { password: await hashPassword(newPassword), sessions: [] }, $addToSet: { authProviders: 'password' } }
		);
		await startSession(res, user);

		return res.status(200).json({ success: true, message: 'Password updated' });
	} catch (err) {
		console.error('change_password error:', err);
		return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
	}
}


// Continue with Google. Existing accounts (by googleId, then by verified email) sign in;
// a new person must also send a role and accept the terms, otherwise 409 ROLE_REQUIRED.
async function google_auth(req, res) {
	const { credential, role, accepted_terms } = req.body || {};
	if (!credential) return res.status(400).json({ success: false, message: 'credential is required' });

	let profile;
	try {
		profile = await google.verify(credential);
	} catch (err) {
		if (err.status === 503) return res.status(503).json({ success: false, message: err.message });
		return res.status(401).json({ success: false, message: 'Google sign-in failed' });
	}

	if (!profile.emailVerified || !profile.email) {
		return res.status(401).json({ success: false, message: 'Your Google email is not verified' });
	}

	const email = profile.email.toLowerCase().trim();

	try {
		let user = await BaseUser.findOne({ googleId: profile.googleId });
		let isNew = false;

		if (!user) {
			user = await BaseUser.findOne({ email }).select('+emailVerified');
			if (user) {
				// Google proves this person owns the email. A password on an account whose email was
				// never verified may belong to someone who signed up with this address first: it's
				// removed and its sessions end (the owner can set a new one). Then Google is linked.
				const unproven = Boolean(user.password) && !user.emailVerified;
				await BaseUser.updateOne({ _id: user._id }, {
					$set: { googleId: profile.googleId, emailVerified: true, ...(unproven && { sessions: [] }) },
					...(unproven ? { $unset: { password: '' }, $pull: { authProviders: 'password' } } : { $addToSet: { authProviders: 'google' } }),
				});
				if (unproven) await BaseUser.updateOne({ _id: user._id }, { $addToSet: { authProviders: 'google' } });
			}
		}

		if (!user) {
			const cleanRole = normalizeRole(role);
			if (!cleanRole || !accepted_terms) {
				return res.status(409).json({ success: false, code: 'ROLE_REQUIRED', name: profile.name || '', email });
			}
			const Model = cleanRole === 'founder' ? Founder : Investor;
			user = await Model.create({
				name:           (profile.name || email.split('@')[0]).slice(0, MAX_NAME),
				email,
				googleId:       profile.googleId,
				avatar:         profile.picture || undefined,
				plan:           'free',
				accepted_terms: true,
				authProviders:  ['google'],
				emailVerified:  true,
			});
			isNew = true;
		}

		await startSession(res, user);
		return res.status(isNew ? 201 : 200).json({ success: true, isNew, user: publicUser(user) });
	} catch (err) {
		if (err && err.code === 11000) {
			return res.status(409).json({ success: false, message: 'An account with this email already exists' });
		}
		console.error('google_auth error:', err);
		return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
	}
}




async function delete_account(req, res) {
	const userId   = req.user._id;
	const userRole = req.user.role;

	const CLEAR_OPTS = {
		httpOnly: true,
		secure:   process.env.NODE_ENV === 'production',
		sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
	};

	try {
		// Guard against one-click deletion: the user types their email to confirm.
		const account = await BaseUser.findById(userId).select('email avatar').lean();
		const confirmEmail = String(req.body?.confirmEmail || '').toLowerCase().trim();
		if (!account || confirmEmail !== account.email) {
			return res.status(400).json({ success: false, message: 'Type your account email to confirm deletion' });
		}

		const { Idea }      = require('../models/ideas.model.js');
		const { Like }      = require('../models/likes.model.js');
		const { Team }      = require('../models/team.model.js');
		const { Portfolio } = require('../models/portfolio.model.js');
		const { purgeIdeas } = require('../services/ideaPurge.js');

		if (userRole === 'Founder') {
			// Each idea goes with its likes, comments, team, files and commitments (P16).
			const ideas = await Idea.find({ founder_id: userId }).select('_id').lean();
			await purgeIdeas(ideas.map(i => i._id));

			
			const teams = await Team.find({ founder_id: userId }).select('_id members').lean();
			const teamIds = teams.map(t => t._id);

			const memberIds = teams.flatMap(t => t.members.map(m => m.user_id));

			await Promise.all([
				Team.deleteMany({ founder_id: userId }),
				
				BaseUser.updateMany(
					{ _id: { $in: memberIds } },
					{ $pull: { teams: { $in: teamIds } } }
				),
			]);
		}

		if (userRole === 'Investor') {
			
			await Portfolio.deleteOne({ investor_id: userId });
		}

		
		const memberTeams = await Team.find({ 'members.user_id': userId }).select('_id').lean();
		if (memberTeams.length > 0) {
			const memberTeamIds = memberTeams.map(t => t._id);
			await Team.updateMany(
				{ _id: { $in: memberTeamIds } },
				{ $pull: { members: { user_id: userId } } }
			);
		}

		// Take this user's likes back off the counters before deleting them (X-89).
		// aggregate() doesn't cast, and the JWT carries the id as a string.
		const likerId = new (require('mongoose').Types.ObjectId)(String(userId));
		const liked = await Like.aggregate([{ $match: { userId: likerId } }, { $group: { _id: '$postID', n: { $sum: 1 } } }]);
		if (liked.length) {
			await Idea.bulkWrite(liked.map(({ _id, n }) => ({ updateOne: { filter: { _id }, update: { $inc: { likes: -n } } } })));
		}
		await Like.deleteMany({ userId });

		// Their comments on other people's ideas go too, and come off each idea's count (C1).
		const { Comment } = require('../models/comments.model.js');
		const { Report }  = require('../models/report.model.js');
		const { isShown } = require('../community/targets.js');
		const { forgetReporter } = require('../services/reports.service.js');
		const cache = require('../utils/cache.js');
		// Their problems go with their votes and replies (C3).
		const { Problem } = require('../models/problem.model.js');
		const { purgeProblems } = require('./problems.controller.js');
		const { forgetVoter } = require('../services/votes.service.js');
		const ownProblems = await Problem.find({ authorId: userId }).select('_id').lean();
		await purgeProblems(ownProblems.map((p) => p._id));

		const comments = await Comment.find({ userId }).select('postID targetType moderation').lean();
		if (comments.length) {
			// Each parent's count drops by the shown comments it loses (ideas and problems).
			const perParent = { Idea: new Map(), Problem: new Map() };
			for (const c of comments) {
				if (!isShown(c.moderation)) continue;
				const m = perParent[c.targetType === 'Problem' ? 'Problem' : 'Idea'];
				m.set(String(c.postID), (m.get(String(c.postID)) || 0) + 1);
			}
			if (perParent.Idea.size) {
				await Idea.bulkWrite([...perParent.Idea].map(([_id, n]) => ({ updateOne: { filter: { _id }, update: { $inc: { comments: -n } } } })));
			}
			if (perParent.Problem.size) {
				await Problem.bulkWrite([...perParent.Problem].map(([_id, n]) => ({ updateOne: { filter: { _id }, update: { $inc: { commentsCount: -n } } } })));
			}
			await Report.deleteMany({ targetType: 'comment', targetId: { $in: comments.map((c) => c._id) } });
			await Comment.deleteMany({ userId });
			await cache.del(...new Set(comments.filter((c) => c.targetType !== 'Problem').map((c) => `comments:v2:${c.postID}`)));
		}
		// Reports they filed are withdrawn, and votes they cast come back off the counts.
		await forgetReporter(userId);
		await forgetVoter(userId);
		// Their chats go for both sides, with every message and block (C5).
		await require('../chat/chat.service.js').forgetChats(userId);
		// Team invites they sent or received (C6).
		await require('../services/teams.service.js').forgetInvites(userId);
		// Everything the agent stored about them: memory, reviews, runs, checkpoints, usage (P16).
		await require('../agent/purge.js').purgeAgentForUser(userId);
		// The Something box's questions and answers, including memory confirms that quote their
		// values ("Pune → Bangalore, right?").
		await Promise.all([
			require('../models/questionState.model.js').QuestionState.deleteMany({ userId }),
			require('../models/questionCadence.model.js').QuestionCadence.deleteMany({ userId }),
		]);

		// Their picture goes too (only our own uploads; a Google photo URL is left alone).
		await require('../utils/uploads.js').removeAvatar(account.avatar);
		await BaseUser.findByIdAndDelete(userId);

		
		res.clearCookie('accessToken',  CLEAR_OPTS);
		res.clearCookie('refreshToken', CLEAR_OPTS);

		return res.status(200).json({
			success: true,
			message: 'Account and all associated data permanently deleted',
		});

	} catch (err) {
		console.error('delete_account error:', err);
		return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
	}
}
