const { Investor } = require('../models/user.model.js');


const PROFILE_SELECT =
	'name email avatar plan ' +
	'firm bio minCheck maxCheck totalCapitalPool ' +
	'interests invest_stage twitter stageFocus ' +
	'publicProfile handle trust trustBreakdown links portfolio ' +
	'escrowPreference ndaPreference openSourcePreference ' +
	'hardwarePreference cryptographyPreference pacePerQuarter ' +
	'customMatchKeywords notes leadStatus legalStructures ' +
	'vehicles superpowers coInvestors createdAt';


const toProfileShape = (doc) => ({
	name:             doc.name             || '',
	email:            doc.email            || '',
	avatarUrl:        doc.avatar           || '',
	plan:             doc.plan             || 'free',
	firm:             doc.firm             || '',
	bio:              doc.bio              || '',
	minCheck:         doc.minCheck         ?? 5000,
	maxCheck:         doc.maxCheck         ?? 50000,
	totalCapitalPool: doc.totalCapitalPool ?? 1000000,
	interests:        doc.interests        || [],
	stageFocus:       doc.stageFocus       || [],
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
	legalStructures:        doc.legalStructures         || [],
	vehicles:               doc.vehicles                || [],
	superpowers:            doc.superpowers             || [],
	coInvestors:            doc.coInvestors             || [],
});


const assertInvestor = (req, res) => {
	if (req.user.role !== 'Investor') {
		res.status(403).json({ success: false, message: 'Investor account required' });
		return false;
	}
	return true;
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

	const { name, firm, minCheck, maxCheck, bio, totalCapitalPool } = req.body;
	const updates = {};

	if (name !== undefined) {
		if (typeof name !== 'string' || !name.trim())
			return res.status(400).json({ success: false, message: 'name must be a non-empty string' });
		updates.name = name.trim();
	}
	if (firm             !== undefined) updates.firm             = String(firm).trim();
	if (bio              !== undefined) updates.bio              = String(bio).trim();
	if (minCheck         !== undefined) updates.minCheck         = Number(minCheck);
	if (maxCheck         !== undefined) updates.maxCheck         = Number(maxCheck);
	if (totalCapitalPool !== undefined) updates.totalCapitalPool = Number(totalCapitalPool);

	if (Object.keys(updates).length === 0)
		return res.status(400).json({ success: false, message: 'No valid fields provided' });

	try {
		const doc = await Investor
			.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true })
			.select(PROFILE_SELECT)
			.lean();

		if (!doc) return res.status(404).json({ success: false, message: 'Profile not found' });
		return res.status(200).json(toProfileShape(doc));
	} catch (err) {
		console.error('investor update_profile:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};


const PREF_VALUES = ['yes', 'maybe', 'no'];
const update_preferences = async (req, res) => {
	if (!assertInvestor(req, res)) return;

	const {
		escrowPreference, ndaPreference, openSourcePreference,
		hardwarePreference, cryptographyPreference,
		pacePerQuarter, stageFocus, customMatchKeywords,
		notes, leadStatus, legalStructures, vehicles,
		superpowers, coInvestors, totalCapitalPool
	} = req.body;

	const updates = {};

	const prefFields = { escrowPreference, ndaPreference, openSourcePreference, hardwarePreference, cryptographyPreference };
	for (const [key, val] of Object.entries(prefFields)) {
		if (val !== undefined) {
			if (!PREF_VALUES.includes(val))
				return res.status(400).json({ success: false, message: `${key} must be yes, maybe, or no` });
			updates[key] = val;
		}
	}

	if (pacePerQuarter  !== undefined) updates.pacePerQuarter  = Number(pacePerQuarter);
	if (totalCapitalPool !== undefined) updates.totalCapitalPool = Number(totalCapitalPool);
	if (stageFocus        !== undefined) { if (!Array.isArray(stageFocus))        return res.status(400).json({ success: false, message: 'stageFocus must be an array' });        updates.stageFocus        = stageFocus; }
	if (customMatchKeywords !== undefined) { if (!Array.isArray(customMatchKeywords)) return res.status(400).json({ success: false, message: 'customMatchKeywords must be an array' }); updates.customMatchKeywords = customMatchKeywords; }
	if (legalStructures   !== undefined) { if (!Array.isArray(legalStructures))   return res.status(400).json({ success: false, message: 'legalStructures must be an array' });   updates.legalStructures   = legalStructures; }
	if (vehicles          !== undefined) { if (!Array.isArray(vehicles))          return res.status(400).json({ success: false, message: 'vehicles must be an array' });          updates.vehicles          = vehicles; }
	if (superpowers       !== undefined) { if (!Array.isArray(superpowers))       return res.status(400).json({ success: false, message: 'superpowers must be an array' });       updates.superpowers       = superpowers; }
	if (coInvestors       !== undefined) { if (!Array.isArray(coInvestors))       return res.status(400).json({ success: false, message: 'coInvestors must be an array' });       updates.coInvestors       = coInvestors; }
	if (notes             !== undefined) { if (!Array.isArray(notes))             return res.status(400).json({ success: false, message: 'notes must be an array' });             updates.notes             = notes; }
	if (leadStatus !== undefined) {
		if (!['lead', 'follow', 'both'].includes(leadStatus))
			return res.status(400).json({ success: false, message: 'leadStatus must be lead, follow, or both' });
		updates.leadStatus = leadStatus;
	}

	if (Object.keys(updates).length === 0)
		return res.status(400).json({ success: false, message: 'No valid fields provided' });

	try {
		const doc = await Investor
			.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true })
			.select(PROFILE_SELECT)
			.lean();

		if (!doc) return res.status(404).json({ success: false, message: 'Profile not found' });
		return res.status(200).json(toProfileShape(doc));
	} catch (err) {
		console.error('investor update_preferences:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};


const update_interests = async (req, res) => {
	if (!assertInvestor(req, res)) return;

	const { interests } = req.body;
	if (!Array.isArray(interests))
		return res.status(400).json({ success: false, message: 'interests must be an array' });

	try {
		const doc = await Investor
			.findByIdAndUpdate(req.user._id, { $set: { interests } }, { new: true })
			.select(PROFILE_SELECT)
			.lean();

		if (!doc) return res.status(404).json({ success: false, message: 'Profile not found' });
		return res.status(200).json(toProfileShape(doc));
	} catch (err) {
		console.error('investor update_interests:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};



const update_visibility = async (req, res) => {
	if (!assertInvestor(req, res)) return;

	const { publicProfile, handle } = req.body;
	const updates = {};

	if (publicProfile !== undefined) updates.publicProfile = Boolean(publicProfile);
	if (handle        !== undefined) updates.handle        = String(handle).trim();

	if (Object.keys(updates).length === 0)
		return res.status(400).json({ success: false, message: 'Provide publicProfile or handle' });

	try {
		const doc = await Investor
			.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true })
			.select(PROFILE_SELECT)
			.lean();

		if (!doc) return res.status(404).json({ success: false, message: 'Profile not found' });
		return res.status(200).json(toProfileShape(doc));
	} catch (err) {
		console.error('investor update_visibility:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};



const update_avatar = async (req, res) => {
	if (!assertInvestor(req, res)) return;

	if (!req.file)
		return res.status(400).json({ success: false, message: 'No file uploaded' });

	const url = `/uploads/avatars/${req.file.filename}`;

	try {
		await Investor.findByIdAndUpdate(req.user._id, { avatar: url });
		return res.status(200).json({ success: true, url });
	} catch (err) {
		console.error('investor update_avatar:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

module.exports = {
	get_profile,
	update_profile,
	update_preferences,
	update_interests,
	update_visibility,
	update_avatar
};
