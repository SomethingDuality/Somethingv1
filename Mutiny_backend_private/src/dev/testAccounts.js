// The two test accounts for local development. `npm run dev:memory` creates them, and the
// one-click dev login (`/auth/dev-login`, never on in production) signs in as them.
const TEST_ACCOUNTS = [
	{ name: 'Fiona Founder', email: 'founder@something.test',  role: 'Founder' },
	{ name: 'Ivan Investor', email: 'investor@something.test', role: 'Investor' },
];

module.exports = { TEST_ACCOUNTS };
