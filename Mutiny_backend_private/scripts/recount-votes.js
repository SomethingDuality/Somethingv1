// Recounts every problem's votes and replies from the rows themselves (community C3).
//   node scripts/recount-votes.js            dry run: prints what would change
//   node scripts/recount-votes.js --apply    writes the changes
// Uses MONGO_URI from .env. Counters only drift after a crash mid-write or a manual DB edit;
// this puts them back.
require('dotenv').config();
const mongoose = require('mongoose');

const HIDDEN_STATES = ['hidden', 'removed'];

async function recount({ apply = false, log = console.log } = {}) {
	const db = mongoose.connection;
	const problems = db.collection('problems');
	const votes = db.collection('votes');
	const comments = db.collection('comments');

	const tally = new Map();
	for await (const v of votes.find({ targetType: 'problem' }, { projection: { targetId: 1, value: 1 } })) {
		const t = tally.get(String(v.targetId)) || { up: 0, down: 0 };
		if (v.value === 1) t.up++; else if (v.value === -1) t.down++;
		tally.set(String(v.targetId), t);
	}
	const replies = new Map();
	for await (const c of comments.find({ targetType: 'Problem', 'moderation.state': { $nin: HIDDEN_STATES } }, { projection: { postID: 1 } })) {
		replies.set(String(c.postID), (replies.get(String(c.postID)) || 0) + 1);
	}

	let fixed = 0;
	for await (const p of problems.find({}, { projection: { upvotes: 1, downvotes: 1, score: 1, commentsCount: 1 } })) {
		const t = tally.get(String(p._id)) || { up: 0, down: 0 };
		const want = { upvotes: t.up, downvotes: t.down, score: t.up - t.down, commentsCount: replies.get(String(p._id)) || 0 };
		const changed = Object.keys(want).some((k) => (p[k] || 0) !== want[k]);
		if (changed) {
			fixed++;
			if (apply) await problems.updateOne({ _id: p._id }, { $set: want });
		}
	}
	log(`${apply ? 'Fixed' : 'Would fix'}: ${fixed} problems`);
	return { fixed };
}

if (require.main === module) {
	const apply = process.argv.includes('--apply');
	mongoose.connect(process.env.MONGO_URI)
		.then(() => recount({ apply }))
		.then(() => mongoose.disconnect())
		.catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { recount };
