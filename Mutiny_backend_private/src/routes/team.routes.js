const express = require('express');
const router  = express.Router();

const c = require('../controllers/team.controller.js');
const { protect } = require('../middleware/auth.middleware.js');
const { make } = require('../middleware/rateLimits.js');

// Community plan C6: invites 20/day per founder.
const inviteLimiter = make('team-invites', { windowMs: 24 * 60 * 60 * 1000, limit: 20, byUser: true });

router.use(protect);

router.get('/mine',                     c.my_teams);
router.get('/invites',                  c.list_invites);
router.post('/invites',                 inviteLimiter, c.create_invite);
router.post('/invites/:id/accept',      c.accept_invite);
router.post('/invites/:id/decline',     c.decline_invite);
router.post('/invites/:id/revoke',      c.revoke_invite);
router.get('/:id',                      c.get_team);
router.delete('/:id/members/:userId',   c.remove_member);
router.post('/:id/leave',               c.leave_team);

module.exports = router;
