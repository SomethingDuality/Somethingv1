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

	password: {
		type: String,
		required: true
	},

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

	refreshToken: { type: String },

	
	notifications: [{
		_id:       { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
		text:      { type: String, required: true },
		timestamp: { type: Date,   default: Date.now },
		// Idempotency key: the same event replayed never creates a second notification.
		key:       { type: String },
		read:      { type: Boolean, default: false }
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
		website:  { type: String, default: '' }
	},

	skills:    [{ type: String }],
	interests: [{ type: String }],

	work_experience: [workExperienceSchema],
	education:       [educationSchema],

	profileCompletion: { type: Number, default: 0 },
	isVerified:        { type: Boolean, default: false },
	githubVerified:    { type: Boolean, default: false },
	walletVerified:    { type: Boolean, default: false },

	
	
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
