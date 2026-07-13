const { BaseUser } = require('../models/user.model.js');



const get_notifications = async (req, res) => {
	try {
		const user = await BaseUser
			.findById(req.user._id)
			.select('notifications')
			.lean();

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
				read:      false   
			}));

		return res.status(200).json(queue);
	} catch (err) {
		console.error('get_notifications:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};



const mark_all_read = async (req, res) => {
	try {
		await BaseUser.findByIdAndUpdate(
			req.user._id,
			{ $set: { notifications: [] } }
		);

		return res.status(200).json({ success: true, message: 'All notifications cleared' });
	} catch (err) {
		console.error('mark_all_read:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};



const mark_one_read = async (req, res) => {
	const { id } = req.params;

	try {
		await BaseUser.findByIdAndUpdate(
			req.user._id,
			{ $pull: { notifications: { _id: id } } }
		);

		return res.status(200).json({ success: true, message: 'Notification removed' });
	} catch (err) {
		console.error('mark_one_read:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};




const pushNotification = async (userId, text) => {
	await BaseUser.findByIdAndUpdate(
		userId,
		{ $push: { notifications: { text } } }
	);
};

module.exports = {
	get_notifications,
	mark_all_read,
	mark_one_read,
	pushNotification
};
