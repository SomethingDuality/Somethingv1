// Loads shared/question-bank.json and checks it against the schemas and the taxonomy at boot,
// so a typo in the bank fails fast instead of silently asking an unwritable question.
const bank = require('../shared/question-bank.generated.json');
const tax = require('../shared/taxonomy.js');
const { FIELDS } = require('../profile/fields.js');

const TYPES = ['chips', 'text', 'yes_no'];
const WRITERS = ['set', 'checkSize', 'pace'];

const byId = new Map();
for (const q of bank.questions) {
	const where = `question-bank: ${q.id}`;
	if (byId.has(q.id)) throw new Error(`${where} is duplicated`);
	if (!TYPES.includes(q.type)) throw new Error(`${where} has unknown type ${q.type}`);
	if (q.writer && !WRITERS.includes(q.writer)) throw new Error(`${where} has unknown writer ${q.writer}`);
	const registry = FIELDS[q.entity];
	if (!registry) throw new Error(`${where} has unknown entity ${q.entity}`);
	for (const f of q.fields) {
		const def = registry[f];
		if (!def) throw new Error(`${where} writes ${f}, which isn't an editable ${q.entity} field`);
		if (def.roles && !q.roles.every((r) => def.roles.includes(r))) throw new Error(`${where}: ${f} isn't editable by ${q.roles}`);
	}
	if (q.options?.from && !tax.list(q.options.from).length) throw new Error(`${where} options from unknown taxonomy ${q.options.from}`);
	for (const u of q.unlocks || []) if (!bank.contexts[u]) throw new Error(`${where} unlocks unknown context ${u}`);
	byId.set(q.id, q);
}

const optionsFor = (q) => {
	if (q.options?.inline) return q.options.inline.map((o) => ({ value: o.id, label: o.label }));
	if (q.options?.from) return tax.list(q.options.from).map((o) => ({ value: o.id, label: o.label }));
	if (q.type === 'yes_no') {
		const base = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];
		return q.allowMaybe ? [base[0], { value: 'maybe', label: 'Depends' }, base[1]] : base;
	}
	return undefined;
};

module.exports = { bank, questions: bank.questions, contexts: bank.contexts, get: (id) => byId.get(id), optionsFor };
