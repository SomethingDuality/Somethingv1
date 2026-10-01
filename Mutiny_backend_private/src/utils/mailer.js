// Outgoing email. There is no mail provider yet: with MAIL_TRANSPORT=console (the dev default)
// the message is printed to the server log. It never goes back to the HTTP client.

const sendPasswordReset = async (email, link) => {
	const transport = process.env.MAIL_TRANSPORT || 'console';
	if (transport === 'console') {
		console.log(`[Mail] Password reset for ${email}: ${link}`);
		return;
	}
	console.error(`[Mail] MAIL_TRANSPORT=${transport} is not implemented; reset email to ${email} was not sent`);
};

module.exports = { sendPasswordReset };
