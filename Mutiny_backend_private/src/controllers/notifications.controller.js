const mongoose = require('mongoose');
const { BaseUser } = require('../models/user.model.js');
const { pushNotification } = require('../services/notifications.service.js');

// Newest first, with a real read flag. Reading no longer deletes: "Clear" does that.
const get_notifications = async (req, res) => {
	try {
		const user = await BaseUser.findById(req.user._id).select('notifications').lean();
		if (!user) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}

		const queue = (user.notifications || [])
			.slice()
			.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
			.map(n => ({
				id:        n._id,
				text:      n.text,
				timestamp: n.timestamp,
				read:      Boolean(n.read),
				link:      n.link || null,
			}));

		return res.status(200).json(queue);
	} catch (err) {
		console.error('get_notifications:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

// What the shell polls every 20 s for its badges: unread notifications, and chats (C5).
const inbox_summary = async (req, res) => {
	try {
		const user = await BaseUser.findById(req.user._id).select('notifications.read').lean();
		if (!user) return res.status(404).json({ success: false, message: 'User not found' });
		const unread = (user.notifications || []).filter((n) => !n.read).length;
		const { chatSummary } = require('../chat/chat.service.js');
		const chats = await chatSummary(req.user._id);
		return res.status(200).json({ serverTime: new Date().toISOString(), notifications: { unread }, chats });
	} catch (err) {
		console.error('inbox_summary:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const mark_all_read = async (req, res) => {
	try {
		await BaseUser.updateOne({ _id: req.user._id }, { $set: { 'notifications.$[].read': true } });
		return res.status(200).json({ success: true, message: 'All notifications marked read' });
	} catch (err) {
		console.error('mark_all_read:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const mark_one_read = async (req, res) => {
	const { id } = req.params;
	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ success: false, message: 'Invalid notification ID' });
	}
	try {
		await BaseUser.updateOne(
			{ _id: req.user._id, 'notifications._id': id },
			{ $set: { 'notifications.$.read': true } },
		);
		return res.status(200).json({ success: true, message: 'Notification marked read' });
	} catch (err) {
		console.error('mark_one_read:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const delete_one = async (req, res) => {
	const { id } = req.params;
	if (!mongoose.Types.ObjectId.isValid(id)) {
		return res.status(400).json({ success: false, message: 'Invalid notification ID' });
	}
	try {
		await BaseUser.updateOne({ _id: req.user._id }, { $pull: { notifications: { _id: id } } });
		return res.status(200).json({ success: true, message: 'Notification removed' });
	} catch (err) {
		console.error('delete_one:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const clear_all = async (req, res) => {
	try {
		await BaseUser.updateOne({ _id: req.user._id }, { $set: { notifications: [] } });
		return res.status(200).json({ success: true, message: 'All notifications cleared' });
	} catch (err) {
		console.error('clear_all:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

module.exports = {
	get_notifications,
	mark_all_read,
	mark_one_read,
	delete_one,
	clear_all,
	inbox_summary,
	// Re-exported for existing callers; the implementation lives in services/.
	pushNotification
};
