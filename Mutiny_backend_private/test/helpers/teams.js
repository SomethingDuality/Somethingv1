// The way onto a team since community C6: the member asks to join in a chat, the founder replies
// and sends an invite from that chat, and the member accepts. Returns the chat's id.
const joinTeam = async (owner, member, ideaId, role = 'cto') => {
	const asked = await member.post('/threads', { ideaId, text: 'Could I help with this?' });
	if (![200, 201].includes(asked.status)) throw new Error(`ask: ${JSON.stringify(asked.body)}`);
	const threadId = asked.body.thread.id;
	await owner.post(`/threads/${threadId}/messages`, { text: 'Yes, welcome' });
	const invite = await owner.post('/teams/invites', { threadId, role });
	if (![200, 201].includes(invite.status)) throw new Error(`invite: ${JSON.stringify(invite.body)}`);
	const accepted = await member.post(`/teams/invites/${invite.body.invite.id}/accept`);
	if (accepted.status !== 200) throw new Error(`accept: ${JSON.stringify(accepted.body)}`);
	return threadId;
};

module.exports = { joinTeam };
