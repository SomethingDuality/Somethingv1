const { leaderboard } = require('../services/leaderboards.service.js');
const tax = require('../shared/taxonomy.js');

// GET /leaderboards/:kind?window=week|all&limit=1..25&sectors=a,b (sectors: ideas only)
const get_leaderboard = async (req, res) => {
	const { kind } = req.params;
	if (!['ideas', 'problems'].includes(kind)) return res.status(404).json({ success: false, message: 'Not found' });
	const sectors = String(req.query.sectors || '')
		.split(',').map((s) => tax.normalize('sectors', s.trim())).filter((s) => s && tax.isKnown('sectors', s)).slice(0, 12);
	try {
		return res.status(200).json(await leaderboard({ kind, window: req.query.window, limit: req.query.limit, sectors }));
	} catch (err) {
		console.error('get_leaderboard:', err);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

module.exports = { get_leaderboard };
