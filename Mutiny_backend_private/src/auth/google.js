const { OAuth2Client } = require('google-auth-library');

let client = null;

// Verifies a Google Identity Services credential (an ID token) for our client id.
// Kept behind this module so tests can replace `google.verify`.
const google = {
	async verify(credential) {
		const clientId = process.env.GOOGLE_CLIENT_ID;
		if (!clientId) {
			const err = new Error('Google sign-in is not configured');
			err.status = 503;
			throw err;
		}
		if (!client) client = new OAuth2Client(clientId);
		const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
		const p = ticket.getPayload();
		return {
			googleId:      p.sub,
			email:         p.email,
			emailVerified: p.email_verified === true,
			name:          p.name,
			picture:       p.picture,
		};
	},
};

module.exports = google;
