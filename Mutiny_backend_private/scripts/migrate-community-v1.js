// One-off, idempotent clean-up for community C1/C2.
//   node scripts/migrate-community-v1.js            dry run: prints what would change
//   node scripts/migrate-community-v1.js --apply    writes the changes
// Uses MONGO_URI from .env.
//  - Founders' supports of their own ideas are deleted (self-support is no longer allowed).
//  - Every idea's `likes` is recounted from the support rows, and `comments` from its comments
//    that are shown (hidden and removed ones don't count).
require('dotenv').config();
const mongoose = require('mongoose');

const HIDDEN_STATES = ['hidden', 'removed'];

async function migrate({ apply = false, log = console.log } = {}) {
	const db = mongoose.connection;
	const ideas = db.collection('ideas');
	const likes = db.collection('likes');
	const comments = db.collection('comments');
	const stats = { selfSupports: 0, likesFixed: 0, commentsFixed: 0 };

	const founderOf = new Map();
	for await (const i of ideas.find({}, { projection: { founder_id: 1 } })) founderOf.set(String(i._id), String(i.founder_id));

	const selfIds = [];
	for await (const l of likes.find({}, { projection: { postID: 1, userId: 1 } })) {
		if (founderOf.get(String(l.postID)) === String(l.userId)) selfIds.push(l._id);
	}
	stats.selfSupports = selfIds.length;
	if (apply && selfIds.length) await likes.deleteMany({ _id: { $in: selfIds } });
	const skip = new Set(selfIds.map(String));

	const likeCount = new Map();
	for await (const l of likes.find({}, { projection: { postID: 1 } })) {
		if (skip.has(String(l._id))) continue;
		likeCount.set(String(l.postID), (likeCount.get(String(l.postID)) || 0) + 1);
	}
	const commentCount = new Map();
	for await (const c of comments.find({ 'moderation.state': { $nin: HIDDEN_STATES } }, { projection: { postID: 1 } })) {
		commentCount.set(String(c.postID), (commentCount.get(String(c.postID)) || 0) + 1);
	}

	for await (const i of ideas.find({}, { projection: { likes: 1, comments: 1 } })) {
		const $set = {};
		const wantLikes = likeCount.get(String(i._id)) || 0;
		const wantComments = commentCount.get(String(i._id)) || 0;
		if ((i.likes || 0) !== wantLikes) { $set.likes = wantLikes; stats.likesFixed++; }
		if ((i.comments || 0) !== wantComments) { $set.comments = wantComments; stats.commentsFixed++; }
		if (apply && Object.keys($set).length) await ideas.updateOne({ _id: i._id }, { $set });
	}

	log(`${apply ? 'Fixed' : 'Would fix'}: ${stats.selfSupports} self-supports deleted, ${stats.likesFixed} support counts, ${stats.commentsFixed} comment counts`);
	return stats;
}

if (require.main === module) {
	const apply = process.argv.includes('--apply');
	mongoose.connect(process.env.MONGO_URI)
		.then(() => migrate({ apply }))
		.then(() => mongoose.disconnect())
		.catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { migrate };
