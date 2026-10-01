// C17: when the review goes live, tell every founder who asked ("Tell me when it's live") and take
// them off the list. Notifies real users, so it runs only on Somay's go.
//   node scripts/notify-review-waitlist.js          dry run: counts who would be told
//   node scripts/notify-review-waitlist.js --send   sends (idempotent: key review-live)
require('dotenv').config();
const mongoose = require('mongoose');
const { Founder } = require('../src/models/user.model.js');
const { pushNotification } = require('../src/services/notifications.service.js');

const TEXT = 'Something and Nothing can read your ideas now. Try it on one of yours.';

const run = async ({ send = false, log = console.log } = {}) => {
	const founders = await Founder.find({ 'reviewWaitlist.joinedAt': { $ne: null } }).select('_id').lean();
	log(`[waitlist] ${founders.length} founder(s) on the review waitlist${send ? '' : ' (dry run: add --send to notify them)'}`);
	if (!send) return { waiting: founders.length, sent: 0 };
	let sent = 0;
	for (const f of founders) {
		await pushNotification(f._id, TEXT, { key: 'review-live', link: '/founder/something' });
		await Founder.updateOne({ _id: f._id }, { $set: { 'reviewWaitlist.joinedAt': null } });
		sent += 1;
	}
	log(`[waitlist] notified ${sent} founder(s) and cleared the list`);
	return { waiting: founders.length, sent };
};

if (require.main === module) {
	(async () => {
		if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');
		await mongoose.connect(process.env.MONGO_URI);
		await run({ send: process.argv.includes('--send') });
		await mongoose.disconnect();
	})().catch((err) => { console.error('[waitlist]', err.message); process.exit(1); });
}

module.exports = { run, TEXT };
