const mongoose = require('mongoose');
const { Idea } = require('../models/ideas.model.js');
const { Portfolio } = require('../models/portfolio.model.js');
const { pushNotification } = require('../services/notifications.service.js');
const cache = require('../utils/cache.js');

const MAX_MILESTONES = 10;
const MAX_TITLE = 120;
const MAX_PROOF = 500;

const shape = (m) => ({ id: m._id, title: m.title, status: m.status, doneAt: m.doneAt, proof: m.proof || '' });

// The founder's own idea (as a document, to edit its milestones), or an error response.
const ownIdea = async (req, res) => {
	const { id } = req.params;
	if (!mongoose.Types.ObjectId.isValid(id)) {
		res.status(400).json({ success: false, message: 'Invalid idea ID' });
		return null;
	}
	const idea = await Idea.findById(id);
	if (!idea) {
		res.status(404).json({ success: false, message: 'Idea not found' });
		return null;
	}
	if (String(idea.founder_id) !== String(req.user._id)) {
		res.status(403).json({ success: false, message: 'Only the founder can change milestones' });
		return null;
	}
	return idea;
};

const cleanTitle = (v) => (typeof v === 'string' ? v.trim() : '');

const add_milestone = async (req, res) => {
	const title = cleanTitle(req.body?.title);
	if (!title) return res.status(400).json({ success: false, message: 'Name the milestone' });
	if (title.length > MAX_TITLE) return res.status(400).json({ success: false, message: `Keep it under ${MAX_TITLE} characters` });
	try {
		const idea = await ownIdea(req, res);
		if (!idea) return;
		if (idea.milestones.length >= MAX_MILESTONES) {
			return res.status(409).json({ success: false, message: `An idea can have up to ${MAX_MILESTONES} milestones` });
		}
		idea.milestones.push({ title });
		await idea.save();
		await cache.del(`user_ideas:${idea.founder_id}`);
		return res.status(201).json(shape(idea.milestones[idea.milestones.length - 1]));
	} catch (err) {
		console.error('add_milestone:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

// Rename, mark done (optionally with a proof link or note) or reopen. Marking one done tells
// the investors who committed that they can record a release against it.
const update_milestone = async (req, res) => {
	const { mid } = req.params;
	if (!mongoose.Types.ObjectId.isValid(mid)) return res.status(400).json({ success: false, message: 'Invalid milestone ID' });
	const { title, status, proof } = req.body || {};
	if (status !== undefined && !['open', 'done'].includes(status)) {
		return res.status(400).json({ success: false, message: 'status must be open or done' });
	}
	if (proof !== undefined && (typeof proof !== 'string' || proof.trim().length > MAX_PROOF)) {
		return res.status(400).json({ success: false, message: `Keep the proof under ${MAX_PROOF} characters` });
	}
	try {
		const idea = await ownIdea(req, res);
		if (!idea) return;
		const m = idea.milestones.id(mid);
		if (!m) return res.status(404).json({ success: false, message: 'Milestone not found' });

		if (title !== undefined) {
			const t = cleanTitle(title);
			if (!t || t.length > MAX_TITLE) return res.status(400).json({ success: false, message: `Name it in up to ${MAX_TITLE} characters` });
			m.title = t;
		}
		if (proof !== undefined) m.proof = proof.trim();
		const justDone = status === 'done' && m.status !== 'done';
		if (status !== undefined) {
			m.status = status;
			m.doneAt = status === 'done' ? (m.doneAt || new Date()) : null;
		}
		await idea.save();
		await cache.del(`user_ideas:${idea.founder_id}`);

		if (justDone && !idea.isDraft) {
			const portfolios = await Portfolio.find({ 'investments.idea_id': idea._id }).select('investor_id').lean();
			await Promise.all(portfolios.map((p) => pushNotification(
				p.investor_id,
				`“${idea.title}” finished “${m.title}”. You can record a release for it.`,
				{ key: `milestone:${m._id}:${p.investor_id}` },
			)));
		}
		return res.status(200).json(shape(m));
	} catch (err) {
		console.error('update_milestone:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const delete_milestone = async (req, res) => {
	const { mid } = req.params;
	if (!mongoose.Types.ObjectId.isValid(mid)) return res.status(400).json({ success: false, message: 'Invalid milestone ID' });
	try {
		const idea = await ownIdea(req, res);
		if (!idea) return;
		const m = idea.milestones.id(mid);
		if (!m) return res.status(404).json({ success: false, message: 'Milestone not found' });
		m.deleteOne();
		await idea.save();
		await cache.del(`user_ideas:${idea.founder_id}`);
		return res.status(200).json({ success: true });
	} catch (err) {
		console.error('delete_milestone:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

module.exports = { add_milestone, update_milestone, delete_milestone };
