// Merges duplicate teams so each idea has one (community C6). Run it BEFORE the unique index on
// Team.idea_id is built on a database that already has duplicates.
//   node scripts/dedupe-teams.js            dry run: prints what would change
//   node scripts/dedupe-teams.js --apply    writes the changes
// Uses MONGO_URI from .env. The oldest team of an idea is kept; members (once each, earliest join
// first) and investors from the others move onto it; users' team lists point at the kept team.
require('dotenv').config();
const mongoose = require('mongoose');

async function dedupe({ apply = false, log = console.log } = {}) {
	const teams = mongoose.connection.collection('teams');
	const users = mongoose.connection.collection('baseusers');
	const groups = await teams.aggregate([
		{ $sort: { createdAt: 1, _id: 1 } },
		{ $group: { _id: '$idea_id', ids: { $push: '$_id' }, n: { $sum: 1 } } },
		{ $match: { n: { $gt: 1 } } },
	]).toArray();

	let removed = 0;
	for (const g of groups) {
		const [keepId, ...dropIds] = g.ids;
		const all = await teams.find({ _id: { $in: g.ids } }).sort({ createdAt: 1, _id: 1 }).toArray();
		const members = new Map();
		const investors = new Map();
		for (const t of all) {
			for (const m of t.members || []) if (!members.has(String(m.user_id))) members.set(String(m.user_id), m);
			for (const i of t.investors || []) investors.set(String(i), i);
		}
		removed += dropIds.length;
		if (!apply) continue;
		await teams.updateOne({ _id: keepId }, { $set: { members: [...members.values()], investors: [...investors.values()] } });
		for (const field of ['teams', 'owned_teams']) {
			const holders = await users.find({ [field]: { $in: dropIds } }).project({ _id: 1 }).toArray();
			for (const u of holders) {
				await users.updateOne({ _id: u._id }, { $pull: { [field]: { $in: dropIds } } });
				await users.updateOne({ _id: u._id }, { $addToSet: { [field]: keepId } });
			}
		}
		await teams.deleteMany({ _id: { $in: dropIds } });
	}
	log(`${apply ? 'Merged' : 'Would merge'}: ${groups.length} ideas with duplicate teams, ${removed} extra teams`);
	return { ideas: groups.length, removed };
}

if (require.main === module) {
	const apply = process.argv.includes('--apply');
	mongoose.connect(process.env.MONGO_URI)
		.then(() => dedupe({ apply }))
		.then(() => mongoose.disconnect())
		.catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { dedupe };
