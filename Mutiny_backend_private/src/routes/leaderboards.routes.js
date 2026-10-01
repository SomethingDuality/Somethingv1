const express = require('express');
const router  = express.Router();

const { get_leaderboard } = require('../controllers/leaderboards.controller.js');

// Public: counts only, never who supported or voted (community C4).
router.get('/:kind', get_leaderboard);

module.exports = router;
