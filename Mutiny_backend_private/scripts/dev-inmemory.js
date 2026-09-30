// Dev-only: runs the API against a throwaway in-memory MongoDB, for when Docker isn't available.
// Data is lost when the process stops. Kafka is off (events run in-process); Redis is optional.
// MongoDB runs as a one-node replica set on a fixed port (MONGO_MEMORY_PORT, 27018), because the
// agent (agent/, port 8000) shares this database and its memory writes use transactions.
//   npm run dev:memory             (seeds the test accounts, turns on one-click dev login)
//   DEV_SEED=false npm run dev:memory
//   DEV_LOGIN=false npm run dev:memory
require('dotenv').config();
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { TEST_ACCOUNTS } = require('../src/dev/testAccounts.js');

// Test-only accounts. They exist only inside this in-memory database.
const SEED_PASSWORD = 'dev-only-Password1';
const SEED_USERS = TEST_ACCOUNTS;
const SEED_IDEA = {
	title: 'Campus compost',
	description: 'Pickup and composting for university canteens, paid per kilo diverted from landfill.',
	isDraft: false,
};

// More local-only test founders and ideas, so lists, filters and covers can be judged with
// more than one row. They exist only in this throwaway database (DEV_SEED=false skips them).
const SEED_PASSWORD_EXTRA = SEED_PASSWORD;
const EXTRA_FOUNDERS = [
	{
		name: 'Asha Rao', email: 'asha@something.test', location: 'Indiranagar, Bangalore',
		ideas: [
			{ title: 'Ledger for kirana stores', description: 'A WhatsApp-first credit ledger for neighbourhood shops, with reminders customers actually answer.', tags: ['fintech', 'consumer'], stage: 'mvp', raising: '100k_500k', lookingFor: ['designer', 'marketing'], milestones: ['50 shops onboarded', 'First repayment cycle', 'Break-even per shop'], done: 1 },
			{ title: 'Exam-season tutor matching', description: 'Matches college seniors with juniors for paid, short tutoring blocks before exams.', tags: ['education'], stage: 'prototype', raising: 'lt_25k' },
		],
	},
	{
		name: 'Kabir Shah', email: 'kabir@something.test', location: 'Pune',
		ideas: [
			{ title: 'Edge model for crop disease', description: 'A phone-sized model that spots leaf disease offline, for farmers without a signal.', tags: ['ai_ml', 'agri_food'], stage: 'prototype', raising: '25k_100k', lookingFor: ['ml_engineer', 'backend'], milestones: ['Field test in 3 villages', 'Model under 20 MB'], done: 2 },
			{ title: 'Private health records vault', description: 'Families keep scans and prescriptions encrypted on their phones and share one link with a doctor.', tags: ['health', 'privacy_security'], stage: 'concept', raising: 'not_raising' },
			{ title: 'API audit trail for startups', description: 'Drop-in logging that answers "who changed what, when" for SOC2 without a data team.', tags: ['dev_tools', 'saas_b2b'], stage: 'launched', raising: '500k_plus', lookingFor: ['backend', 'pm'], milestones: ['10 paying teams', 'SOC2 template pack'], done: 1 },
		],
	},
];

const waitForServer = async (base) => {
	for (let i = 0; i < 100; i++) {
		try {
			if ((await fetch(`${base}/health`)).ok) return;
		} catch {
			// not listening yet
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	throw new Error('server did not start');
};

// Seeds through the public API, so passwords are hashed and validation runs as for real users.
const seed = async () => {
	const base = `http://localhost:${process.env.PORT || 5050}`;
	await waitForServer(base);
	for (const u of SEED_USERS) {
		const res = await fetch(`${base}/auth/signup`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ...u, password: SEED_PASSWORD, accepted_terms: true }),
		});
		if (!res.ok) throw new Error(`seed signup ${u.email}: ${res.status}`);
		if (u.role === 'Founder') {
			const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
			const idea = await fetch(`${base}/ideas`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', cookie },
				body: JSON.stringify(SEED_IDEA),
			});
			if (!idea.ok) throw new Error(`seed idea: ${idea.status}`);
		}
	}
	let extraIdeas = 0;
	for (const f of EXTRA_FOUNDERS) {
		const res = await fetch(`${base}/auth/signup`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: f.name, email: f.email, role: 'founder', password: SEED_PASSWORD_EXTRA, accepted_terms: true }),
		});
		if (!res.ok) throw new Error(`seed signup ${f.email}: ${res.status}`);
		const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
		const call = (path, method, body) => fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) });
		await call('/founder/profile', 'PUT', { location: f.location });
		for (const idea of f.ideas) {
			const { milestones = [], done = 0, ...fields } = idea;
			const r = await call('/ideas', 'POST', { ...fields, isDraft: false });
			if (!r.ok) throw new Error(`seed idea ${idea.title}: ${r.status}`);
			const { _id } = await r.json();
			for (let i = 0; i < milestones.length; i++) {
				const m = await (await call(`/ideas/${_id}/milestones`, 'POST', { title: milestones[i] })).json();
				if (i < done) await call(`/ideas/${_id}/milestones/${m.id}`, 'PUT', { status: 'done' });
			}
			extraIdeas++;
		}
	}
	console.log(`[dev:memory] seeded ${SEED_USERS.map((u) => u.email).join(', ')} (password in scripts/dev-inmemory.js) + ${1 + extraIdeas} public ideas from ${1 + EXTRA_FOUNDERS.length} test founders`);
};

(async () => {
	const port = Number(process.env.MONGO_MEMORY_PORT) || 27018;
	const mongod = await MongoMemoryReplSet.create({ replSet: { count: 1, name: 'rs0', storageEngine: 'wiredTiger' }, instanceOpts: [{ port }] });
	process.env.MONGO_URI     = mongod.getUri('something_dev');
	// Dev-only placeholder keys for Node <-> agent; the agent refuses them in production.
	process.env.NODE_TO_AGENT_KEY ??= 'dev-only-node-to-agent';
	process.env.AGENT_TO_NODE_KEY ??= 'dev-only-agent-to-node';
	process.env.AGENT_URL         ??= 'http://127.0.0.1:8000';
	process.env.KAFKA_ENABLED = 'false';
	process.env.DEV_LOGIN   ??= 'true';
	// Locally the test founder is the admin (approves investor verification at /admin).
	process.env.ADMIN_EMAILS ??= TEST_ACCOUNTS.find((a) => a.role === 'Founder').email;
	console.log('[dev:memory] in-memory MongoDB at', process.env.MONGO_URI);
	console.log(`[dev:memory] agent: ${process.env.AGENT_URL} (start it with the "agent" preview; MONGO_URI above)`);
	console.log(
		process.env.DEV_LOGIN !== 'true'   ? '[dev:memory] one-click dev login off (DEV_LOGIN is not true)'
		: process.env.NODE_ENV === 'production' ? '[dev:memory] one-click dev login off (NODE_ENV=production)'
		: '[dev:memory] one-click dev login on: /login shows "Continue as test founder / investor"'
	);
	const stop = () => mongod.stop().finally(() => process.exit(0));
	process.once('SIGINT', stop);
	process.once('SIGTERM', stop);
	require('../src/index.js');
	if (process.env.DEV_SEED !== 'false') seed().catch((err) => console.error('[dev:memory] seed failed:', err.message));
})();
