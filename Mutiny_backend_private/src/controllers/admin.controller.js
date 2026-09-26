const mongoose = require('mongoose');
const { Investor } = require('../models/user.model.js');
const { pushNotification } = require('../services/notifications.service.js');

const STATUSES = ['pending', 'verified', 'rejected'];

// Investors who asked to be verified (P13: a LinkedIn link checked by hand), newest first.
const list_verifications = async (req, res) => {
	const status = STATUSES.includes(req.query.status) ? req.query.status : 'pending';
	try {
		const docs = await Investor.find({ 'verification.status': status })
			.select('name email firm verification').sort({ 'verification.submittedAt': -1 }).limit(200).lean();
		return res.status(200).json(docs.map((d) => ({
			userId:      d._id,
			name:        d.name || '',
			email:       d.email || '',
			firm:        d.firm || '',
			linkedin:    d.verification?.linkedin || '',
			status:      d.verification?.status,
			submittedAt: d.verification?.submittedAt || null,
			reviewedAt:  d.verification?.reviewedAt || null,
			note:        d.verification?.note || '',
		})));
	} catch (err) {
		console.error('list_verifications:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const decide_verification = async (req, res) => {
	const { userId } = req.params;
	const { decision } = req.body || {};
	const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 300) : '';
	if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ success: false, message: 'Invalid user ID' });
	if (!['verify', 'reject'].includes(decision)) return res.status(400).json({ success: false, message: 'decision must be verify or reject' });
	if (decision === 'reject' && !note) return res.status(400).json({ success: false, message: 'Say why, so the investor knows what to fix' });
	try {
		const status = decision === 'verify' ? 'verified' : 'rejected';
		const r = await Investor.updateOne(
			{ _id: userId, 'verification.status': 'pending' },
			{ $set: { 'verification.status': status, 'verification.reviewedAt': new Date(), 'verification.note': note } },
		);
		if (r.matchedCount === 0) return res.status(404).json({ success: false, message: 'No pending request for this investor' });
		await pushNotification(userId, decision === 'verify'
			? 'You are verified. Founders now see "verified investor" next to your name.'
			: `Your verification wasn't approved: ${note}`);
		return res.status(200).json({ success: true, status });
	} catch (err) {
		console.error('decide_verification:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

module.exports = { list_verifications, decide_verification };
