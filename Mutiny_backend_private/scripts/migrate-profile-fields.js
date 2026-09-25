// One-off, idempotent migration of legacy profile data into the current shape.
//   node scripts/migrate-profile-fields.js            dry run: prints what would change
//   node scripts/migrate-profile-fields.js --apply    writes the changes
// Uses MONGO_URI from .env. Legacy fields are kept (not unset) for one release.
require('dotenv').config();
const mongoose = require('mongoose');
const tax = require('../src/shared/taxonomy.js');

const LEGACY_STAGE = { angel: ['angel'], preseed: ['pre_seed', 'seed'], growth: ['series_a', 'series_b_plus'] };
const INVESTOR_DEFAULTS = {
	minCheck: 5000, maxCheck: 50000, totalCapitalPool: 1000000, pacePerQuarter: 4, leadStatus: 'both',
	escrowPreference: 'yes', ndaPreference: 'yes', openSourcePreference: 'maybe', hardwarePreference: 'maybe', cryptographyPreference: 'maybe',
};

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

async function migrate({ apply = false, log = console.log } = {}) {
	const users = mongoose.connection.collection('baseusers');
	const ideas = mongoose.connection.collection('ideas');
	const stats = { founders: 0, investors: 0, ideas: 0 };
	const at = new Date();

	for await (const u of users.find({ role: 'Founder' })) {
		const $set = {};
		if (u.linkedin && !u.socials?.linkedin) $set['socials.linkedin'] = u.linkedin;
		if (u.github && !u.socials?.github) $set['socials.github'] = u.github;
		const skills = tax.normalizeList('skills', [...(u.skills || []), ...(u.expertise || [])]);
		if (!same(skills, u.skills || [])) $set.skills = skills;
		const interests = tax.normalizeList('sectors', u.interests || []);
		if (!same(interests, u.interests || [])) $set.interests = interests;
		for (const path of Object.keys($set)) $set[`fieldSources.${path.replace(/\./g, '__')}`] = { source: 'legacy', at };
		if (Object.keys($set).length) {
			stats.founders++;
			log(`founder ${u._id}: ${Object.keys($set).filter((k) => !k.startsWith('fieldSources')).join(', ')}`);
			if (apply) await users.updateOne({ _id: u._id }, { $set });
		}
	}

	for await (const u of users.find({ role: 'Investor' })) {
		const $set = {};
		const rawInterests = tax.normalizeList('sectors', u.interests || []);
		const stagesInInterests = rawInterests.filter((v) => tax.isKnown('fundingStages', tax.normalize('fundingStages', v)));
		const interests = rawInterests.filter((v) => !stagesInInterests.includes(v));
		const stageFocus = tax.normalizeList('fundingStages', [...(u.stageFocus || []), ...(LEGACY_STAGE[u.invest_stage] || []), ...stagesInInterests]);
		if (!same(interests, u.interests || [])) $set.interests = interests;
		if (!same(stageFocus, u.stageFocus || [])) $set.stageFocus = stageFocus;
		for (const kind of ['legalStructures', 'vehicles', 'superpowers']) {
			const v = tax.normalizeList(kind, u[kind] || []);
			if (!same(v, u[kind] || [])) $set[kind] = v;
		}
		for (const path of Object.keys($set)) $set[`fieldSources.${path}`] = { source: 'legacy', at };
		// A value that differs from the schema default was set by the investor at some point.
		for (const [k, def] of Object.entries(INVESTOR_DEFAULTS)) {
			if (u[k] !== undefined && u[k] !== def && !u.fieldSources?.[k]) $set[`fieldSources.${k}`] = { source: 'legacy', at };
		}
		if (Object.keys($set).length) {
			stats.investors++;
			log(`investor ${u._id}: ${Object.keys($set).map((k) => k.replace('fieldSources.', '†')).join(', ')}`);
			if (apply) await users.updateOne({ _id: u._id }, { $set });
		}
	}

	for await (const idea of ideas.find({})) {
		const $set = {};
		const tags = tax.normalizeList('sectors', idea.tags || []);
		const lookingFor = tax.normalizeList('roles', idea.lookingFor || []);
		if (!same(tags, idea.tags || [])) $set.tags = tags;
		if (!same(lookingFor, idea.lookingFor || [])) $set.lookingFor = lookingFor;
		if (Object.keys($set).length) {
			stats.ideas++;
			if (apply) await ideas.updateOne({ _id: idea._id }, { $set });
		}
	}

	log(`${apply ? 'Updated' : 'Would update'}: ${stats.founders} founders, ${stats.investors} investors, ${stats.ideas} ideas`);
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
