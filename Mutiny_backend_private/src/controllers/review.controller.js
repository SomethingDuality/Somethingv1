const mongoose = require('mongoose');
const { Idea } = require('../models/ideas.model.js');
const { Founder } = require('../models/user.model.js');
const { findOverlaps } = require('../services/overlaps.js');

const MAX_TEXT = 2000;

const founderOnly = (req, res) => {
	if (req.user.role === 'Founder') return true;
	res.status(403).json({ success: false, message: 'Founder account required' });
	return false;
};

// Ideas on Something that look like yours: one of your saved ideas (ideaId) or text you typed.
// Typed text is compared and thrown away (P16: nothing is kept that you didn't save).
const overlaps = async (req, res) => {
	if (!founderOnly(req, res)) return;
	const { ideaId } = req.body || {};
	const typed = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
	try {
		let source;
		let exclude = null;
		if (ideaId) {
			if (!mongoose.Types.ObjectId.isValid(ideaId)) return res.status(400).json({ success: false, message: 'Invalid idea ID' });
			const own = await Idea.findOne({ _id: ideaId, founder_id: req.user._id }).select('title description tags').lean();
			if (!own) return res.status(404).json({ success: false, message: 'Idea not found' });
			source = { text: `${own.title} ${own.description}`, sectors: own.tags || [] };
			exclude = own._id;
		} else {
			if (!typed) return res.status(400).json({ success: false, message: 'Describe the idea first' });
			if (typed.length > MAX_TEXT) return res.status(400).json({ success: false, message: `Keep it under ${MAX_TEXT} characters` });
			source = { text: typed, sectors: [] };
		}

		// Public ideas from other founders only.
		const candidates = await Idea.find({ isDraft: false, founder_id: { $ne: req.user._id }, ...(exclude && { _id: { $ne: exclude } }) })
			.select('title description tags stage author createdAt').sort({ createdAt: -1 }).limit(2000).lean();
		const found = findOverlaps(source, candidates);

		return res.status(200).json({
			compared: candidates.length,
			matches: found.map(({ idea, score, sharedWords, sharedSectors }) => ({
				id: idea._id,
				title: idea.title,
				author: idea.author,
				stage: idea.stage || '',
				tags: idea.tags || [],
				score: Math.round(score * 100) / 100,
				sharedWords,
				sharedSectors,
			})),
		});
	} catch (err) {
		console.error('overlaps:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

// "Tell me when Something and Nothing can review my ideas": a flag on the founder, nothing more.
const get_waitlist = async (req, res) => {
	if (!founderOnly(req, res)) return;
	try {
		const f = await Founder.findById(req.user._id).select('reviewWaitlist').lean();
		return res.status(200).json({ joined: Boolean(f?.reviewWaitlist?.joinedAt), joinedAt: f?.reviewWaitlist?.joinedAt || null });
	} catch (err) {
		console.error('get_waitlist:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const set_waitlist = (join) => async (req, res) => {
	if (!founderOnly(req, res)) return;
	try {
		const joinedAt = join ? new Date() : null;
		await Founder.updateOne({ _id: req.user._id }, { $set: { 'reviewWaitlist.joinedAt': joinedAt } });
		return res.status(200).json({ joined: join, joinedAt });
	} catch (err) {
		console.error('set_waitlist:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

module.exports = { overlaps, get_waitlist, join_waitlist: set_waitlist(true), leave_waitlist: set_waitlist(false) };
