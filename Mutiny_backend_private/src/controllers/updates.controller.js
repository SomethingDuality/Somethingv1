const mongoose = require('mongoose');
const { Idea } = require('../models/ideas.model.js');
const { IdeaUpdate } = require('../models/ideaUpdate.model.js');
const { BaseUser, Investor } = require('../models/user.model.js');
const { Portfolio } = require('../models/portfolio.model.js');
const { pushNotification } = require('../services/notifications.service.js');

const MAX_TEXT = 1000;
const UPDATES_PER_DAY = 5;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const excerpt = (s, n = 80) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// The idea, or null when this caller may not see it (drafts are owner-only, like GET /ideas/:id).
const visibleIdea = async (id, user) => {
	if (!mongoose.Types.ObjectId.isValid(id)) return null;
	const idea = await Idea.findById(id).select('title founder_id isDraft').lean();
	if (!idea) return null;
	const isOwner = user && String(idea.founder_id) === String(user._id);
	return idea.isDraft && !isOwner ? null : { ...idea, isOwner };
};

// Everyone following the idea: investors who saved it and investors who committed to it.
const followersOf = async (ideaId) => {
	const [savers, portfolios] = await Promise.all([
		Investor.find({ watchlist: ideaId }).select('_id').lean(),
		Portfolio.find({ 'investments.idea_id': ideaId }).select('investor_id').lean(),
	]);
	return [...new Set([...savers.map((u) => String(u._id)), ...portfolios.map((p) => String(p.investor_id))])];
};

const list_updates = async (req, res) => {
	try {
		const idea = await visibleIdea(req.params.id, req.user);
		if (!idea) return res.status(404).json({ success: false, message: 'Idea not found' });
		const updates = await IdeaUpdate.find({ idea_id: idea._id }).sort({ createdAt: -1 }).limit(50).lean();
		return res.status(200).json(updates.map((u) => ({ id: u._id, text: u.text, createdAt: u.createdAt })));
	} catch (err) {
		console.error('list_updates:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const post_update = async (req, res) => {
	const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
	if (!text) return res.status(400).json({ success: false, message: 'Write the update first' });
	if (text.length > MAX_TEXT) return res.status(400).json({ success: false, message: `Keep it under ${MAX_TEXT} characters` });

	try {
		const idea = await visibleIdea(req.params.id, req.user);
		if (!idea) return res.status(404).json({ success: false, message: 'Idea not found' });
		if (!idea.isOwner) return res.status(403).json({ success: false, message: 'Only the founder can post updates' });

		const recent = await IdeaUpdate.countDocuments({ idea_id: idea._id, createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
		if (recent >= UPDATES_PER_DAY) {
			return res.status(429).json({ success: false, message: `You can post up to ${UPDATES_PER_DAY} updates a day on one idea` });
		}

		const update = await IdeaUpdate.create({ idea_id: idea._id, founder_id: req.user._id, text });

		// Drafts have no followers to tell.
		if (!idea.isDraft) {
			const founder = await BaseUser.findById(req.user._id).select('name').lean();
			const followers = await followersOf(idea._id);
			await Promise.all(followers.map((uid) => pushNotification(
				uid,
				`${founder?.name || 'The founder'} posted an update on “${idea.title}”: ${excerpt(text)}`,
				{ key: `update:${update._id}:${uid}` },
			)));
		}

		return res.status(201).json({ id: update._id, text: update.text, createdAt: update.createdAt });
	} catch (err) {
		console.error('post_update:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const delete_update = async (req, res) => {
	const { updateId } = req.params;
	if (!mongoose.Types.ObjectId.isValid(updateId)) {
		return res.status(400).json({ success: false, message: 'Invalid update ID' });
	}
	try {
		const idea = await visibleIdea(req.params.id, req.user);
		if (!idea) return res.status(404).json({ success: false, message: 'Idea not found' });
		if (!idea.isOwner) return res.status(403).json({ success: false, message: 'Only the founder can delete updates' });
		const r = await IdeaUpdate.deleteOne({ _id: updateId, idea_id: idea._id });
		if (r.deletedCount === 0) return res.status(404).json({ success: false, message: 'Update not found' });
		return res.status(200).json({ success: true });
	} catch (err) {
		console.error('delete_update:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

// An investor asks the founder for an update: at most once a week per idea (the notification
// key carries the week, so a repeat inside the same week changes nothing).
const request_update = async (req, res) => {
	if (req.user.role !== 'Investor') {
		return res.status(403).json({ success: false, message: 'Only investors can ask for updates' });
	}
	try {
		const idea = await visibleIdea(req.params.id, req.user);
		if (!idea || idea.isDraft) return res.status(404).json({ success: false, message: 'Idea not found' });

		const key = `update-request:${idea._id}:${req.user._id}:${Math.floor(Date.now() / WEEK_MS)}`;
		const already = await BaseUser.exists({ _id: idea.founder_id, 'notifications.key': key });
		if (already) {
			return res.status(200).json({ success: true, sent: false, message: 'You already asked this week' });
		}
		const investor = await BaseUser.findById(req.user._id).select('name').lean();
		await pushNotification(idea.founder_id, `${investor?.name || 'An investor'} asked for an update on “${idea.title}”`, { key });
		return res.status(200).json({ success: true, sent: true });
	} catch (err) {
		console.error('request_update:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

module.exports = { list_updates, post_update, delete_update, request_update };
