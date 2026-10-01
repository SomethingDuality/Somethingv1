// Forwards selected domain events to the agent (/internal/events), so memory stays current.
// Runs inside the event handlers, which execute under Kafka or in-process alike, so this works in
// both modes. The agent dedupes by eventId. Events are hints: the agent reconciles from Node's
// documents, so a lost event heals on the next one. Never throws.
const { agentFetch, enabled } = require('./client.js');

const FORWARDED = new Set([
	'idea.created', 'idea.updated', 'idea.deleted',
	'idea.milestone_done', 'idea.update_posted', 'idea.attachment_added', 'idea.attachment_removed',
	'profile.updated', 'question.answered',
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const forwardEvent = async (event) => {
	if (!enabled() || !FORWARDED.has(event?.eventType)) return;
	if (event.source === 'agent') return; // the agent's own writes: don't echo them back
	for (const wait of [0, 300, 1200]) {
		if (wait) await sleep(wait);
		try {
			const res = await agentFetch('/internal/events', { method: 'POST', body: event, timeoutMs: 2000 });
			if (res.status < 500) return;
		} catch {
			// retry below
		}
	}
	console.warn(`[agent] could not forward ${event.eventType} ${event.eventId}; the agent reconciles on the next event`);
};

module.exports = { forwardEvent, FORWARDED };
