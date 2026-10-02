const { Investor } = require('../models/user.model.js');
const uploads = require('../utils/uploads.js');
const { applyUpdate, FieldError } = require('../profile/applyUpdate.js');
const tax = require('../shared/taxonomy.js');
const { PUBLIC_IDEA } = require('../community/targets.js');


const PROFILE_SELECT =
	'name email avatar plan linkedin ' +
	'firm bio minCheck maxCheck totalCapitalPool ' +
	'interests invest_stage twitter stageFocus ' +
	'publicProfile handle trust trustBreakdown links portfolio ' +
	'escrowPreference ndaPreference openSourcePreference ' +
	'hardwarePreference cryptographyPreference pacePerQuarter ' +
	'customMatchKeywords notes leadStatus legalStructures ' +
	'vehicles superpowers coInvestors fieldSources createdAt verification';

// Signup used to store a single invest_stage; read it as a fallback for stageFocus.
const LEGACY_STAGE = { angel: ['angel'], preseed: ['pre_seed', 'seed'], growth: ['series_a', 'series_b_plus'] };

const fieldSourceKeys = (doc) => {
	const fs = doc.fieldSources;
	if (!fs) return [];
	const keys = fs instanceof Map ? [...fs.keys()] : Object.keys(fs);
	return keys.map((k) => k.replace(/__/g, '.'));
};

const toProfileShape = (doc) => {
	const interests = tax.normalizeList('sectors', doc.interests || []);
	// Old signup chips mixed stages ("Pre-seed", "Series A") into interests; move them to stageFocus.
	const stagesInInterests = interests.filter((v) => tax.isKnown('fundingStages', tax.normalize('fundingStages', v)));
	return {
		name:             doc.name             || '',
		email:            doc.email            || '',
		avatarUrl:        doc.avatar           || '',
		plan:             doc.plan             || 'free',
		firm:             doc.firm             || '',
		bio:              doc.bio              || '',
		twitter:          doc.twitter          || '',
		linkedin:         doc.linkedin         || '',
		minCheck:         doc.minCheck         ?? 5000,
		maxCheck:         doc.maxCheck         ?? 50000,
		totalCapitalPool: doc.totalCapitalPool ?? 1000000,
		interests:        interests.filter((v) => !stagesInInterests.includes(v)),
		stageFocus:       tax.normalizeList('fundingStages', [
			...(doc.stageFocus || []),
			...(LEGACY_STAGE[doc.invest_stage] || []),
			...stagesInInterests,
		]),
		publicProfile:    doc.publicProfile    ?? true,
		handle:           doc.handle           || '',
		trust:            doc.trust            || 0,
		trustBreakdown:   doc.trustBreakdown   || { ndas: 0, escrowReleases: 0, receipts: 0, history: 0 },
		links:            doc.links            || [],
		portfolio:        (doc.portfolio || []).map(p => ({ id: p.ideaId || p._id, name: p.name })),
		escrowPreference:       doc.escrowPreference       || 'yes',
		ndaPreference:          doc.ndaPreference          || 'yes',
		openSourcePreference:   doc.openSourcePreference   || 'maybe',
		hardwarePreference:     doc.hardwarePreference     || 'maybe',
		cryptographyPreference: doc.cryptographyPreference || 'maybe',
		pacePerQuarter:         doc.pacePerQuarter         ?? 4,
		customMatchKeywords:    doc.customMatchKeywords     || [],
		notes:                  doc.notes                  || [],
		leadStatus:             doc.leadStatus              || 'both',
		legalStructures:        tax.normalizeList('legalStructures', doc.legalStructures || []),
		vehicles:               tax.normalizeList('vehicles', doc.vehicles || []),
		superpowers:            tax.normalizeList('superpowers', doc.superpowers || []),
		coInvestors:            doc.coInvestors             || [],
		verification: {
			status:      doc.verification?.status      || 'none',
			linkedin:    doc.verification?.linkedin    || '',
			submittedAt: doc.verification?.submittedAt || null,
			reviewedAt:  doc.verification?.reviewedAt  || null,
			note:        doc.verification?.note        || '',
		},
		// Fields the investor actually set (vs schema defaults like minCheck 5000).
		knownFields:            fieldSourceKeys(doc),
	};
};


const assertInvestor = (req, res) => {
	if (req.user.role !== 'Investor') {
		res.status(403).json({ success: false, message: 'Investor account required' });
		return false;
	}
	return true;
};

const writeInvestor = async (req, res, keys, label) => {
	const body = req.body || {};
	const patch = {};
	for (const k of keys) if (body[k] !== undefined) patch[k] = body[k];
	if (Object.keys(patch).length === 0) {
		return res.status(400).json({ success: false, message: 'No valid fields provided' });
	}
	try {
		const doc = await applyUpdate({ userId: req.user._id, role: 'Investor', patch, source: 'profile' });
		if (!doc) return res.status(404).json({ success: false, message: 'Profile not found' });
		return res.status(200).json(toProfileShape(doc));
	} catch (err) {
		if (err instanceof FieldError) return res.status(422).json({ success: false, field: err.path, message: err.message });
		console.error(`investor ${label}:`, err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};


const get_profile = async (req, res) => {
	if (!assertInvestor(req, res)) return;

	try {
		const doc = await Investor
			.findById(req.user._id)
			.select(PROFILE_SELECT)
			.lean();

		if (!doc) return res.status(404).json({ success: false, message: 'Profile not found' });

		return res.status(200).json(toProfileShape(doc));
	} catch (err) {
		console.error('investor get_profile:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};



const update_profile = async (req, res) => {
	if (!assertInvestor(req, res)) return;
	return writeInvestor(req, res, ['name', 'firm', 'bio', 'twitter', 'linkedin', 'minCheck', 'maxCheck', 'totalCapitalPool'], 'update_profile');
};


const update_preferences = async (req, res) => {
	if (!assertInvestor(req, res)) return;
	return writeInvestor(req, res, [
		'escrowPreference', 'ndaPreference', 'openSourcePreference', 'hardwarePreference', 'cryptographyPreference',
		'pacePerQuarter', 'stageFocus', 'customMatchKeywords', 'notes', 'leadStatus',
		'legalStructures', 'vehicles', 'superpowers', 'coInvestors', 'totalCapitalPool',
	], 'update_preferences');
};


const update_interests = async (req, res) => {
	if (!assertInvestor(req, res)) return;
	return writeInvestor(req, res, ['interests'], 'update_interests');
};



const update_visibility = async (req, res) => {
	if (!assertInvestor(req, res)) return;
	return writeInvestor(req, res, ['publicProfile', 'handle'], 'update_visibility');
};



// PUT /investor/ghost-mode { on }: new chats start as "Ghost investor" while it is on.
// Chats already started keep the setting they began with.
const update_ghost_mode = async (req, res) => {
	if (!assertInvestor(req, res)) return;
	if (typeof req.body?.on !== 'boolean') return res.status(400).json({ success: false, message: 'on must be true or false' });
	try {
		await applyUpdate({ userId: req.user._id, role: 'Investor', patch: { ghostMode: req.body.on }, source: 'profile' });
		return res.status(200).json({ success: true, ghostMode: req.body.on });
	} catch (err) {
		if (err instanceof FieldError) return res.status(422).json({ success: false, field: err.path, message: err.message });
		console.error('update_ghost_mode:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const update_avatar = async (req, res) => {
	if (!assertInvestor(req, res)) {
		if (req.file) await uploads.removeStored(uploads.AVATARS_DIR, req.file.filename);
		return;
	}

	if (!req.file)
		return res.status(400).json({ success: false, message: 'No file uploaded' });

	const url = `/uploads/avatars/${req.file.filename}`;

	try {
		const before = await Investor.findByIdAndUpdate(req.user._id, { avatar: url }).select('avatar').lean();
		await uploads.removeAvatar(before?.avatar); // the old picture doesn't stay on disk
		return res.status(200).json({ success: true, url });
	} catch (err) {
		await uploads.removeStored(uploads.AVATARS_DIR, req.file.filename);
		console.error('investor update_avatar:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

// P13: ask to be verified with a LinkedIn link (saved to the profile as well); an admin then
// approves or declines it by hand. Admins get a notification for each new request.
const submit_verification = async (req, res) => {
	if (!assertInvestor(req, res)) return;
	try {
		const current = await Investor.findById(req.user._id).select('verification name').lean();
		if (current?.verification?.status === 'verified') {
			return res.status(409).json({ success: false, message: 'You are already verified' });
		}
		// An empty link must not clear the one already on the profile.
		if (typeof req.body?.linkedin !== 'string' || !req.body.linkedin.trim()) {
			return res.status(422).json({ success: false, field: 'linkedin', message: 'Add your LinkedIn link' });
		}
		// Validates the link exactly like the profile field does, and records where it came from.
		const doc = await applyUpdate({ userId: req.user._id, role: 'Investor', patch: { linkedin: req.body?.linkedin ?? '' }, source: 'profile' });
		if (!doc?.linkedin) return res.status(422).json({ success: false, field: 'linkedin', message: 'Add your LinkedIn link' });

		const submittedAt = new Date();
		await Investor.updateOne({ _id: req.user._id }, { $set: { verification: { status: 'pending', linkedin: doc.linkedin, submittedAt, reviewedAt: null, note: '' } } });

		const { adminEmails } = require('../middleware/admin.middleware.js');
		const { BaseUser } = require('../models/user.model.js');
		const { pushNotification } = require('../services/notifications.service.js');
		const admins = await BaseUser.find({ email: { $in: adminEmails() } }).select('_id').lean();
		await Promise.all(admins.map((a) => pushNotification(a._id, `${current?.name || 'An investor'} asked to be verified`, { key: `verify:${req.user._id}:${submittedAt.getTime()}`, link: '/admin' })));

		const fresh = await Investor.findById(req.user._id).select(PROFILE_SELECT).lean();
		return res.status(200).json(toProfileShape(fresh));
	} catch (err) {
		if (err instanceof FieldError) return res.status(422).json({ success: false, field: err.path, message: err.message });
		console.error('submit_verification:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const WATCHLIST_MAX = 500;

// The saved ideas, newest saved last (the order they were saved in). Drafts and deleted ideas
// drop out on read.
const get_watchlist = async (req, res) => {
	if (!assertInvestor(req, res)) return;
	try {
		const { Idea } = require('../models/ideas.model.js');
		const doc = await Investor.findById(req.user._id).select('watchlist').lean();
		const ids = doc?.watchlist || [];
		const ideas = await Idea.find({ _id: { $in: ids }, ...PUBLIC_IDEA })
			.select('title author stage tags createdAt likes').lean();
		const byId = new Map(ideas.map((i) => [String(i._id), i]));
		return res.status(200).json({
			ids: ids.map(String).filter((id) => byId.has(id)),
			ideas: ids.map((id) => byId.get(String(id))).filter(Boolean),
		});
	} catch (err) {
		console.error('get_watchlist:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const save_idea = async (req, res) => {
	if (!assertInvestor(req, res)) return;
	const { ideaId } = req.params;
	const mongoose = require('mongoose');
	if (!mongoose.Types.ObjectId.isValid(ideaId)) {
		return res.status(400).json({ success: false, message: 'Invalid idea ID' });
	}
	try {
		const { Idea } = require('../models/ideas.model.js');
		const idea = await Idea.findOne({ _id: ideaId, ...PUBLIC_IDEA }).select('_id').lean();
		if (!idea) return res.status(404).json({ success: false, message: 'Idea not found' });
		// The size check and the add are one write, so parallel saves can't pass the cap.
		const r = await Investor.updateOne(
			{ _id: req.user._id, [`watchlist.${WATCHLIST_MAX - 1}`]: { $exists: false } },
			{ $addToSet: { watchlist: idea._id } },
		);
		if (r.matchedCount === 0) {
			return res.status(409).json({ success: false, message: `You can save up to ${WATCHLIST_MAX} ideas` });
		}
		return res.status(200).json({ success: true });
	} catch (err) {
		console.error('save_idea:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const unsave_idea = async (req, res) => {
	if (!assertInvestor(req, res)) return;
	const { ideaId } = req.params;
	const mongoose = require('mongoose');
	if (!mongoose.Types.ObjectId.isValid(ideaId)) {
		return res.status(400).json({ success: false, message: 'Invalid idea ID' });
	}
	try {
		await Investor.updateOne({ _id: req.user._id }, { $pull: { watchlist: new mongoose.Types.ObjectId(ideaId) } });
		return res.status(200).json({ success: true });
	} catch (err) {
		console.error('unsave_idea:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

module.exports = {
	submit_verification,
	update_ghost_mode,
	get_watchlist,
	save_idea,
	unsave_idea,
	get_profile,
	update_profile,
	update_preferences,
	update_interests,
	update_visibility,
	update_avatar
};
