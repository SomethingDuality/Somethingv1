const { BaseUser, Founder, Investor } = require('../models/user.model.js');
const { hashPassword, comparePasswords } = require('../utils/password.util.js');
const {
	generateAccessToken,
	generateRefreshToken,
	generateResetToken,
	verifyAccessToken,
	verifyRefreshToken,
	verifyResetToken,
} = require('../utils/jwt.util.js');



const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).{8,}$/;

const validatePassword = (password) => {
	if (typeof password !== 'string' || password.length < 8) {
		return 'Password must be at least 8 characters';
	}
	if (!/[A-Z]/.test(password)) {
		return 'Password must contain at least one uppercase letter';
	}
	if (!/\d/.test(password)) {
		return 'Password must contain at least one number';
	}
	if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
		return 'Password must contain at least one special character';
	}
	if (!PASSWORD_REGEX.test(password)) {
		return 'Password does not meet complexity requirements';
	}
	return null;
};


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


const signup = async (req, res) => {

	const {
		name,
		email,
		password,
		role,
		plan,
		age,
		linkedin,
		accepted_terms,
		expertise,
		experience,
		occupation,
		github,
		firm,
		interests,
		invest_stage,
		twitter,
	} = req.body;

	if (!name || !email || !password || !role) {
		return res.status(400).json({
			success: false,
			message: 'name, email, password and role are required'
		});
	}

	if (!['founder', 'investor'].includes(role.toLowerCase())) {
		return res.status(400).json({
			success: false,
			message: 'role must be either "founder" or "investor"'
		});
	}

	if (password.length < 8) {
		return res.status(400).json({
			success: false,
			message: 'Password must be at least 8 characters'
		});
	}

	if (!accepted_terms) {
		return res.status(400).json({
			success: false,
			message: 'You must accept the terms and conditions'
		});
	}

	if (role.toLowerCase() === 'founder' && (!expertise || expertise.length === 0)) {
		return res.status(400).json({
			success: false,
			message: 'Founders must provide at least one area of expertise'
		});
	}


	try {
		console.log('[SIGNUP] Checking for existing account:', email.toLowerCase().trim());
		const existing = await BaseUser.findOne({ email: email.toLowerCase().trim() });
		if (existing) {
			return res.status(409).json({
				success: false,
				message: 'An account with this email already exists'
			});
		}
		const hashed = await hashPassword(password);

		const baseFields = {
			name:           name.trim(),
			email:          email.toLowerCase().trim(),
			password:       hashed,
			plan:           plan || 'free',
			accepted_terms: Boolean(accepted_terms),
			linkedin:       linkedin  || undefined,
			age:            age       || undefined,
		};

		let newUser;

		if (role.toLowerCase() === 'founder') {
			console.log('[SIGNUP] Creating Founder with expertise:', expertise);
			newUser = new Founder({
				...baseFields,
				expertise:   Array.isArray(expertise) ? expertise : [],
				experience:  experience  || undefined,
				occupation:  occupation  || undefined,
				github:      github      || undefined,
			});
		} else {
			console.log('[SIGNUP] Creating Investor with firm:', firm, '| invest_stage:', invest_stage);
			newUser = new Investor({
				...baseFields,
				firm:          firm         || undefined,
				interests:     Array.isArray(interests) ? interests : [],
				invest_stage:  invest_stage || undefined,
				twitter:       twitter      || undefined,
			});
		}

		console.log('[SIGNUP] Generating tokens...');
		const accessToken  = generateAccessToken(newUser);
		const refreshToken = generateRefreshToken(newUser);

		newUser.refreshToken = refreshToken;

		await newUser.save();

		console.log('[SIGNUP] Setting cookies (NODE_ENV=%s) sameSite=%s secure=%s',
			process.env.NODE_ENV,
			ACCESS_COOKIE_OPTS.sameSite,
			ACCESS_COOKIE_OPTS.secure
		);
		res.cookie('accessToken',  accessToken,  ACCESS_COOKIE_OPTS);
		res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);

		return res.status(201).json({
			success: true,
			message: 'Account created successfully',
			user: {
				_id:  newUser._id,
				name: newUser.name,
				email: newUser.email,
				role: newUser.role,
				plan: newUser.plan,
			}
		});

	} catch (err) {
		return res.status(500).json({
			success: false,
			message: 'Something went wrong, please try again'
		});
	}
};

const login = async (req, res) => {
	let { email, password } = req.body;


	if (!email || !password) {
		return res.status(400).json({
			success: false,
			message: 'Email and password are required'
		});
	}

	email = email.toLowerCase().trim();

	try {
		console.log('[LOGIN] Looking up user in DB...');
		const user = await BaseUser.findOne({ email });

		if (!user) {
			return res.status(401).json({
				success: false,
				message: 'Invalid credentials'
			});
		}

		console.log('[LOGIN] Comparing passwords...');
		const valid = await comparePasswords(password, user.password);
		if (!valid) {
			return res.status(401).json({
				success: false,
				message: 'Invalid credentials'
			});
		}

		const accessToken  = generateAccessToken(user);
		const refreshToken = generateRefreshToken(user);

		user.refreshToken = refreshToken;
		await user.save();

		console.log('[LOGIN] Setting cookies (NODE_ENV=%s) sameSite=%s secure=%s',
			process.env.NODE_ENV,
			ACCESS_COOKIE_OPTS.sameSite,
			ACCESS_COOKIE_OPTS.secure
		);
		res.cookie('accessToken',  accessToken,  ACCESS_COOKIE_OPTS);
		res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);

		return res.status(200).json({
			success: true,
			message: 'Logged in successfully',
			user: {
				_id:  user._id,
				name: user.name,
				email: user.email,
				role: user.role,
				plan: user.plan,
			}
		});

	} catch (err) {
		console.error('[LOGIN] 💥 Unexpected error:', err.message);
		return res.status(500).json({
			success: false,
			message: 'Something went wrong, please try again'
		});
	}
};

const me = async (req, res) => {
	try {
		const user = await BaseUser.findById(req.user._id).select('-password -refreshToken');
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}
		return res.status(200).json({
			id:    user._id,
			name:  user.name,
			email: user.email,
			role:  user.role,
			plan:  user.plan,
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

module.exports = {
	signup,
	login,
	me,
	logout,
	refresh,
	forgot_password,
	reset_password,
	delete_account,
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

		
		const newAccessToken  = generateAccessToken(user);
		const newRefreshToken = generateRefreshToken(user);

		user.refreshToken = newRefreshToken;
		await user.save();

		const COOKIE_BASE = {
			httpOnly: true,
			secure:   process.env.NODE_ENV === 'production',
			sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
		};

		res.cookie('accessToken',  newAccessToken,  { ...COOKIE_BASE, maxAge: 15 * 60 * 1000 });
		res.cookie('refreshToken', newRefreshToken, { ...COOKIE_BASE, maxAge: 7 * 24 * 60 * 60 * 1000 });

		return res.status(200).json({ success: true });

	} catch (err) {
		console.error('refresh error:', err);
		return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
	}
}





async function forgot_password(req, res) {
	const { email } = req.body;

	if (!email) {
		return res.status(400).json({ success: false, message: 'Email is required' });
	}

	const normalised = email.toLowerCase().trim();

	try {
		const user = await BaseUser.findOne({ email: normalised }).select('_id name email password role');

		
		
		if (!user) {
			return res.status(200).json({
				success: true,
				message: 'If an account with that email exists, a reset token has been issued',
			});
		}

		
		
		
		
		const resetToken = generateResetToken(user);

		return res.status(200).json({
			success: true,
			message: 'If an account with that email exists, a reset token has been issued',
			
			resetToken,
		});

	} catch (err) {
		console.error('forgot_password error:', err);
		return res.status(500).json({ success: false, message: 'Something went wrong, please try again' });
	}
}





async function reset_password(req, res) {
	const { resetToken, newPassword } = req.body;

	if (!resetToken || !newPassword) {
		return res.status(400).json({ success: false, message: 'resetToken and newPassword are required' });
	}

	
	const pwError = validatePassword(newPassword);
	if (pwError) {
		return res.status(400).json({ success: false, message: pwError });
	}

	try {
		
		let decoded;
		try {
			decoded = verifyResetToken(resetToken);
		} catch {
			return res.status(400).json({
				success: false,
				message: 'Reset token is invalid or has expired',
			});
		}

		const { _id, pwHash } = decoded;

		
		const user = await BaseUser.findById(_id).select('_id password');
		if (!user) {
			return res.status(404).json({ success: false, message: 'Account not found' });
		}

		
		
		
		
		if (user.password !== pwHash) {
			return res.status(400).json({
				success: false,
				message: 'Reset token has already been used',
			});
		}

		
		const isSame = await comparePasswords(newPassword, user.password);
		if (isSame) {
			return res.status(400).json({
				success: false,
				message: 'New password must be different from the current password',
			});
		}

		
		const hashed = await hashPassword(newPassword);
		user.password     = hashed;
		user.refreshToken = undefined; 
		await user.save();

		return res.status(200).json({
			success: true,
			message: 'Password reset successfully. Please log in with your new password.',
		});

	} catch (err) {
		console.error('reset_password error:', err);
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
