const mongoose = require('mongoose');

const options = { discriminatorKey: 'role', timestamps: true };


const BaseUserSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		trim: true
	},

	email: {
		type: String,
		required: true,
		unique: true,
		trim: true,
		lowercase: true
	},

	// Not required for accounts created with Continue with Google.
	password: {
		type: String,
		required: function () { return !this.googleId; }
	},

	googleId:      { type: String, unique: true, sparse: true },
	authProviders: [{ type: String, enum: ['password', 'google'] }],

	// Password reset: only the sha256 of the emailed token is stored (see utils/resetToken.util.js).
	passwordResetTokenHash: { type: String, select: false },
	passwordResetExpires:   { type: Date,   select: false },

	// Where each user-set value came from: { source: signup|profile|question|google|legacy|agent, at }.
	// A field with a schema default counts as "known" only once it appears here.
	fieldSources: { type: Map, of: new mongoose.Schema({ source: String, at: Date }, { _id: false }), default: undefined },

	// Set only by the server. Everything is free for now; signup never reads this from the body.
	plan: {
		type: String,
		enum: ['free', 'something', 'something_pro', 'nothing', 'nothing_pro'],
		default: 'free'
	},

	avatar: { type: String },

	linkedin: { type: String },

	age: { type: Number },

	accepted_terms: {
		type: Boolean,
		required: true,
		default: false
	},

	// One session per device or browser (X-47), each with its own rotating refresh token; only the
	// sha256 of a token is stored. prevHash lets a second tab that raced the rotation through
	// for a few seconds instead of signing everyone out. See controllers/user.controller.js.
	sessions: {
		type: [new mongoose.Schema({
			sid: String, hash: String, prevHash: String, rotatedAt: Date, createdAt: Date,
		}, { _id: false })],
		default: [],
		select: false,
	},

	// Set when the person proved they own the email (a link we emailed, or Google). Admin rights
	// need it: ADMIN_EMAILS names addresses, and anyone can sign up with an address first.
	emailVerified:        { type: Boolean, default: false },
	emailVerifyTokenHash: { type: String, select: false },
	emailVerifyExpires:   { type: Date,   select: false },

	
	notifications: [{
		_id:       { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
		text:      { type: String, required: true },
		timestamp: { type: Date,   default: Date.now },
		// Idempotency key: the same event replayed never creates a second notification.
		key:       { type: String },
		read:      { type: Boolean, default: false },
		// The in-app page it opens (a path), e.g. the idea it is about.
		link:      { type: String }
	}],

	
	
	teams: [{
		type: mongoose.Schema.Types.ObjectId,
		ref:  'Team'
	}]
}, options);

const BaseUser = mongoose.model('BaseUser', BaseUserSchema);


const workExperienceSchema = new mongoose.Schema({
	role:        { type: String, required: true, trim: true },
	company:     { type: String, required: true, trim: true },
	duration:    { type: String, default: '' },
	description: { type: String, default: '' }
}, { _id: false });

const educationSchema = new mongoose.Schema({
	institution: { type: String, required: true, trim: true },
	degree:      { type: String, required: true, trim: true },
	duration:    { type: String, default: '' }
}, { _id: false });


const founderSchema = new mongoose.Schema({
	// Ideas posted today (UTC): the 3-a-day limit, counted in one conditional write so parallel
	// posts can't slip past it.
	ideaQuota: { day: String, count: Number },

	expertise: [{ type: String }],

	experience_level: {
		type: String,
		enum: ['junior', 'mid', 'senior', 'founder', 'executive', ''],
		default: ''
	},

	occupation: {
		type: String,
		enum: ['software_engineer', 'product_manager', 'designer', 'business_owner', 'student', 'other', ''],
		default: ''
	},

	github: { type: String },

	
	headline: { type: String, default: '' },
	location: { type: String, default: '' },
	about:    { type: String, default: '' },

	socials: {
		linkedin: { type: String, default: '' },
		twitter:  { type: String, default: '' },
		website:  { type: String, default: '' },
		github:   { type: String, default: '' }
	},

	skills:    [{ type: String }],
	interests: [{ type: String }],

	work_experience: [workExperienceSchema],
	education:       [educationSchema],

	profileCompletion: { type: Number, default: 0 },
	isVerified:        { type: Boolean, default: false },
	githubVerified:    { type: Boolean, default: false },
	walletVerified:    { type: Boolean, default: false },

	
	
	// "Tell me when Something and Nothing can review my ideas" (set on the Something page).
	reviewWaitlist: {
		joinedAt: { type: Date, default: null },
	},

	owned_teams: [{
		type: mongoose.Schema.Types.ObjectId,
		ref:  'Team'
	}]
}, options);


const investorNoteSchema = new mongoose.Schema({
	content:   { type: String, required: true },
	createdAt: { type: String, default: () => new Date().toLocaleDateString() }
}, { _id: true });

const investorSchema = new mongoose.Schema({
	
	firm:  { type: String, default: '' },

	interests: [{ type: String }],

	invest_stage: {
		type: String,
		enum: ['angel', 'preseed', 'growth', ''],
		default: ''
	},

	
	portfolio_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Portfolio',
		default: null
	},

	twitter: { type: String, default: '' },

	
	bio:      { type: String, default: '' },
	minCheck: { type: Number, default: 5000 },
	maxCheck: { type: Number, default: 50000 },
	totalCapitalPool: { type: Number, default: 1000000 },

	stageFocus: [{ type: String }],
	publicProfile: { type: Boolean, default: true },

	// P13: an investor asks to be verified with a LinkedIn link; an admin checks it by hand.
	verification: {
		status:      { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
		linkedin:    { type: String, default: '' },
		submittedAt: { type: Date, default: null },
		reviewedAt:  { type: Date, default: null },
		note:        { type: String, default: '' },
	},

	// Ghost Mode (C5): founders see "Ghost investor" until the investor shares their name.
	// On unless the investor turns it off; each chat keeps the setting it started with.
	ghostMode: { type: Boolean, default: true },
	// Ideas the investor saved ("Save" in Discover); the first stage of their pipeline.
	watchlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Idea' }],
	handle: { type: String, default: '' },

	
	trust: { type: Number, default: 0 },
	trustBreakdown: {
		ndas:           { type: Number, default: 0 },
		escrowReleases: { type: Number, default: 0 },
		receipts:       { type: Number, default: 0 },
		history:        { type: Number, default: 0 }
	},

	links: [{
		label: { type: String },
		href:  { type: String }
	}],

	portfolio: [{
		ideaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Idea' },
		name:   { type: String }
	}],

	
	escrowPreference:       { type: String, enum: ['yes', 'maybe', 'no'], default: 'yes' },
	ndaPreference:          { type: String, enum: ['yes', 'maybe', 'no'], default: 'yes' },
	openSourcePreference:   { type: String, enum: ['yes', 'maybe', 'no'], default: 'maybe' },
	hardwarePreference:     { type: String, enum: ['yes', 'maybe', 'no'], default: 'maybe' },
	cryptographyPreference: { type: String, enum: ['yes', 'maybe', 'no'], default: 'maybe' },

	pacePerQuarter: { type: Number, default: 4 },

	
	customMatchKeywords: [{ type: String }],
	notes: [investorNoteSchema],
	leadStatus: { type: String, enum: ['lead', 'follow', 'both'], default: 'both' },
	legalStructures: [{ type: String }],
	vehicles: [{ type: String }],
	superpowers: [{ type: String }],
	coInvestors: [{ type: String }]
}, options);

const Founder  = BaseUser.discriminator('Founder',  founderSchema);
const Investor = BaseUser.discriminator('Investor', investorSchema);

module.exports = { Investor, Founder, BaseUser };
