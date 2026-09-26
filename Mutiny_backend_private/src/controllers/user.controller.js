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

// Issues a fresh token pair, stores the refresh token and sets both cookies.
const startSession = async (res, user) => {
	const accessToken  = generateAccessToken(user);
	const refreshToken = generateRefreshToken(user);
	await BaseUser.updateOne({ _id: user._id }, { $set: { refreshToken } });
	res.cookie('accessToken',  accessToken,  ACCESS_COOKIE_OPTS);
	res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);
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

	if (!email || !password) {
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
		const user = await BaseUser.findById(req.user._id).select('-refreshToken');
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
			authProviders: user.authProviders?.length ? user.authProviders : ['password'],
		});
	} catch (err) {
		console.error('[ME] 💥 Error:', err.message);
		return res.status(500).json({ success: false, message: 'Something went wrong' });
	}
};


const logout = async (req, res) => {
	const accessToken  = req.cookies?.accessToken;
	const refreshToken = req.cookies?.refreshToken;

	if (!accessToken && !refreshToken) {
		return res.status(400).json({
			success: false,
			message: 'No active session found'
		});
	}

	const CLEAR_OPTS = {
		httpOnly: true,
		secure:   process.env.NODE_ENV === 'production',
		sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
	};

	try {
		let userId = null;

		if (accessToken) {
			try {
				const decoded = verifyAccessToken(accessToken);
				userId = decoded._id;
			} catch {
		
			}
		}

		if (!userId && refreshToken) {
			try {
				const decoded = verifyRefreshToken(refreshToken);
				userId = decoded._id;
			} catch {
				
			}
		}

		if (userId) {
			const updated = await BaseUser.findByIdAndUpdate(
				userId,
				{ $unset: { refreshToken: '' } }
			);

			if (!updated) {
				
				res.clearCookie('accessToken',  CLEAR_OPTS);
				res.clearCookie('refreshToken', CLEAR_OPTS);
				return res.status(404).json({
					success: false,
					message: 'User not found — cookies cleared'
				});
			}
		}

		
		res.clearCookie('accessToken',  CLEAR_OPTS);
		res.clearCookie('refreshToken', CLEAR_OPTS);

		return res.status(200).json({
			success: true,
			message: 'Logged out successfully'
		});

	} catch (err) {
		console.error('logout error:', err);

		
		res.clearCookie('accessToken',  CLEAR_OPTS);
		res.clearCookie('refreshToken', CLEAR_OPTS);

		return res.status(500).json({
			success: false,
			message: 'Logout encountered an error, but session has been cleared'
		});
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
};




async function refresh(req, res) {
	const refreshToken = req.cookies?.refreshToken;

	if (!refreshToken) {
		return res.status(401).json({
			success: false,
			message: 'No refresh token — please log in again',
		});
	}

	try {
		
		let decoded;
		try {
			decoded = verifyRefreshToken(refreshToken);
		} catch {
			return res.status(401).json({
				success: false,
				message: 'Refresh token invalid or expired — please log in again',
			});
		}

		
		
		const user = await BaseUser.findById(decoded._id).select('_id role refreshToken');
		if (!user) {
			return res.status(401).json({ success: false, message: 'User not found' });
		}

		if (!user.refreshToken || user.refreshToken !== refreshToken) {
			
			
			await BaseUser.findByIdAndUpdate(decoded._id, { $unset: { refreshToken: '' } });

			const CLEAR_OPTS = {
				httpOnly: true,
				secure:   process.env.NODE_ENV === 'production',
				sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
			};
			res.clearCookie('accessToken',  CLEAR_OPTS);
			res.clearCookie('refreshToken', CLEAR_OPTS);

			return res.status(401).json({
				success: false,
				message: 'Token reuse detected — all sessions invalidated. Please log in again.',
			});
		}


		await startSession(res, user);

		return res.status(200).json({ success: true });

	} catch (err) {
		console.error('refresh error:', err);
		return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
	}
}





// Always answers the same way, whether or not the account exists (no user enumeration).
// The reset link is emailed; the token is never returned to the client.
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

		// Single use: clearing the hash makes the same link fail next time.
		// Clearing refreshToken signs out every other session.
		await BaseUser.updateOne(
			{ _id: user._id },
			{
				$set:      { password: await hashPassword(newPassword) },
				$unset:    { passwordResetTokenHash: '', passwordResetExpires: '', refreshToken: '' },
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
			if (!ok) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
			if (await comparePasswords(String(newPassword || ''), user.password)) {
				return res.status(400).json({ success: false, message: 'New password must be different from the current one' });
			}
		}

		const pwError = validatePassword(newPassword, { email: user.email });
		if (pwError) return res.status(400).json({ success: false, message: pwError });

		await BaseUser.updateOne(
			{ _id: user._id },
			{ $set: { password: await hashPassword(newPassword) }, $addToSet: { authProviders: 'password' } }
		);

		// Rotate the session so other devices are signed out but this one stays in.
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
			user = await BaseUser.findOne({ email });
			if (user) {
				// Same verified email: link Google to the existing account.
				await BaseUser.updateOne(
					{ _id: user._id },
					{ $set: { googleId: profile.googleId }, $addToSet: { authProviders: 'google' } }
				);
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
		
		const { Idea }      = require('../models/ideas.model.js');
		const { Like }      = require('../models/likes.model.js');
		const { Team }      = require('../models/team.model.js');
		const { Portfolio } = require('../models/portfolio.model.js');

		if (userRole === 'Founder') {
			
			const ideas = await Idea.find({ founder_id: userId }).select('_id').lean();
			const ideaIds = ideas.map(i => i._id);

			await Promise.all([
				Idea.deleteMany({ founder_id: userId }),
				Like.deleteMany({ postID: { $in: ideaIds } }),
			]);

			
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

		
		await Like.deleteMany({ userId });

		
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
