// Deletes everything the agent stored about an idea or a user (P16: "we delete them when you ask").
// The collection list comes from shared/agent-collections.json, so a new agent collection can't be
// forgotten here (the agent's tests check the list against what it writes).
// The agent is first told to stop any running work for them, so nothing writes the data back.
const mongoose = require('mongoose');
const { collections } = require('../shared/agent-collections.generated.json');
const { agentFetch, enabled } = require('./client.js');

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stopAgentWork = async (body) => {
	if (!enabled()) return;
	try {
		await agentFetch('/internal/erase', { method: 'POST', body, timeoutMs: 3000 });
	} catch {
		console.warn('[agent] erase notice failed; rows are deleted anyway');
	}
};

const purge = async (by) => {
	const db = mongoose.connection.db;
	await Promise.all(Object.entries(collections).map(([name, keys]) => {
		const filter = by(keys);
		return filter ? db.collection(name).deleteMany(filter) : null;
	}));
};

// `founderOf` (idea id → founder id) lets checkpoint threads be found by their exact prefix
// (u:<founder>:i:<idea>:), which the thread_id index serves; without it, any user's thread.
const purgeAgentForIdeas = async (ideaIds, founderOf = new Map()) => {
	if (!ideaIds?.length) return;
	const ids = ideaIds.map(String);
	await stopAgentWork({ ideaIds: ids });
	await purge((keys) => (keys.idea ? { [keys.idea]: { $in: ids } } : null));
	const db = mongoose.connection.db;
	const threadCollections = Object.entries(collections).filter(([, keys]) => keys.thread);
	for (const id of ids) {
		const founder = founderOf.get(id);
		const prefix = founder ? `^u:${escapeRe(founder)}:i:${escapeRe(id)}:` : `^u:[^:]+:i:${escapeRe(id)}:`;
		await Promise.all(threadCollections.map(([name, keys]) => db.collection(name).deleteMany({ [keys.thread]: new RegExp(prefix) })));
	}
};

const purgeAgentForUser = async (userId) => {
	const id = String(userId);
	await stopAgentWork({ userId: id });
	const threadRe = new RegExp(`^u:${escapeRe(id)}:`);
	await purge((keys) => {
		if (keys.user) return { [keys.user]: id };
		if (keys.thread) return { [keys.thread]: threadRe };
		return null;
	});
};

module.exports = { purgeAgentForIdeas, purgeAgentForUser };
