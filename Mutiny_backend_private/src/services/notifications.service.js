const { BaseUser } = require('../models/user.model.js');

const MAX_NOTIFICATIONS = 100;

// Writes the notification straight to Mongo. The array is capped so a spammer can't grow
// a user document toward the 16 MB limit, and `key` makes replays of the same event idempotent.
const pushNotification = async (userId, text, { key } = {}) => {
	const filter = { _id: userId };
	if (key) filter['notifications.key'] = { $ne: key };

	await BaseUser.updateOne(filter, {
		$push: {
			notifications: {
				$each:  [{ text, timestamp: new Date(), ...(key && { key }) }],
				$slice: -MAX_NOTIFICATIONS,
			},
		},
	});
};

module.exports = { pushNotification };
