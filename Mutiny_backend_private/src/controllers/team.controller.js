// Teams with invites (community C6). The old routes that let an owner add anyone to a team
// without asking are gone: people join only by accepting an invite (services/teams.service.js).
const teams = require('../services/teams.service.js');

const handle = (label, fn, status = 200) => async (req, res) => {
	if (req.user.role !== 'Founder') return res.status(403).json({ success: false, message: 'Teams are for founders' });
	try {
		return res.status(status).json(await fn(req));
	} catch (err) {
		if (err instanceof teams.TeamError) {
			return res.status(err.status).json({ success: false, message: err.message, ...(err.code && { code: err.code }) });
		}
		console.error(`${label}:`, err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

// POST /teams/invites { threadId, role }
const create_invite = async (req, res) => {
	if (req.user.role !== 'Founder') return res.status(403).json({ success: false, message: 'Teams are for founders' });
	try {
		const out = await teams.inviteFromThread({ user: req.user, threadId: req.body?.threadId, role: req.body?.role });
		return res.status(out.existing ? 200 : 201).json(out);
	} catch (err) {
		if (err instanceof teams.TeamError) {
			return res.status(err.status).json({ success: false, message: err.message, ...(err.code && { code: err.code }) });
		}
		console.error('create_invite:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const list_invites   = handle('list_invites', (req) => teams.listInvites({ user: req.user, box: req.query.box }));
const accept_invite  = handle('accept_invite', (req) => teams.accept({ user: req.user, inviteId: req.params.id }));
const decline_invite = handle('decline_invite', (req) => teams.decline({ user: req.user, inviteId: req.params.id }));
const revoke_invite  = handle('revoke_invite', (req) => teams.revoke({ user: req.user, inviteId: req.params.id }));
const my_teams       = handle('my_teams', (req) => teams.mine({ user: req.user }));
const get_team       = handle('get_team', (req) => teams.getTeam({ user: req.user, teamId: req.params.id }));
const remove_member  = handle('remove_member', (req) => teams.removeMember({ user: req.user, teamId: req.params.id, memberId: req.params.userId }));
const leave_team     = handle('leave_team', (req) => teams.leave({ user: req.user, teamId: req.params.id }));

module.exports = {
	create_invite, list_invites, accept_invite, decline_invite, revoke_invite, my_teams, get_team, remove_member, leave_team,
};
