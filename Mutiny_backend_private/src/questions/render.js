// The question as the client sees it.
const { contexts, optionsFor } = require('./bank.js');
const tax = require('../shared/taxonomy.js');

const render = ({ question: q, entityId, entityLabel }, reason, context) => ({
	id: q.id,
	type: q.type,
	prompt: q.prompt.replace('{ideaTitle}', entityLabel || 'your idea'),
	help: q.help,
	placeholder: q.placeholder,
	format: q.format,
	maxLength: q.maxLength,
	options: optionsFor(q),
	suggestions: q.suggestions?.from ? tax.list(q.suggestions.from).map((o) => o.label) : undefined,
	select: q.select,
	allowCustom: Boolean(q.allowCustom),
	entity: q.entity,
	entityId: entityId || null,
	entityLabel: entityLabel || null,
	reason,
	context: context || null,
	contextLabel: context && contexts[context] ? contexts[context].label : null,
	// What answering helps with (every question, not only just-in-time ones).
	helpsWith: (q.unlocks || []).map((c) => contexts[c]?.label).filter(Boolean),
});

module.exports = { render };
