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

const purgeAgentForIdeas = async (ideaIds) => {
	if (!ideaIds?.length) return;
	const ids = ideaIds.map(String);
	await stopAgentWork({ ideaIds: ids });
	const threadRe = new RegExp(`^u:[^:]+:i:(${ids.map(escapeRe).join('|')}):`);
	await purge((keys) => {
		if (keys.idea) return { [keys.idea]: { $in: ids } };
		if (keys.thread) return { [keys.thread]: threadRe };
		return null;
	});
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
