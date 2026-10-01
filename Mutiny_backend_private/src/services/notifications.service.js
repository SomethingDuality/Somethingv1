const { BaseUser } = require('../models/user.model.js');

const MAX_NOTIFICATIONS = 100;

// Writes the notification straight to Mongo. The array is capped so a spammer can't grow
// a user document toward the 16 MB limit, and `key` makes replays of the same event idempotent.
// `link` is the in-app page the notification opens (always a path in this app, never a URL).
const pushNotification = async (userId, text, { key, link } = {}) => {
	const filter = { _id: userId };
	if (key) filter['notifications.key'] = { $ne: key };
	const safeLink = typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') ? link : undefined;

	await BaseUser.updateOne(filter, {
		$push: {
			notifications: {
				$each:  [{ text, timestamp: new Date(), ...(key && { key }), ...(safeLink && { link: safeLink }) }],
				$slice: -MAX_NOTIFICATIONS,
			},
		},
	});
};

// Where a notification about an idea should open, for the person receiving it.
const ideaLink = (role, ideaId) =>
	String(role).toLowerCase() === 'investor' ? `/investor/search/${ideaId}` : `/founder/ideas/${ideaId}`;

module.exports = { pushNotification, ideaLink };
