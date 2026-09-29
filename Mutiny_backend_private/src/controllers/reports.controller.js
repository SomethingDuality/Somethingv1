const { createReport, applyAction, listQueue, ReportError } = require('../services/reports.service.js');

const fail = (res, err, label) => {
	if (err instanceof ReportError) return res.status(err.status).json({ success: false, message: err.message });
	console.error(`${label}:`, err);
	return res.status(500).json({ success: false, message: 'Internal server error' });
};

// POST /reports { type: idea|comment, id, reason, note? }
const report = async (req, res) => {
	const { type, id, reason, note } = req.body || {};
	try {
		const result = await createReport({ reporterId: req.user._id, type, id, reason, note });
		return res.status(result.alreadyReported ? 200 : 201).json({ success: true, alreadyReported: result.alreadyReported });
	} catch (err) {
		return fail(res, err, 'report');
	}
};

// GET /admin/moderation?view=hidden|reported|review
const moderation_queue = async (req, res) => {
	try {
		return res.status(200).json(await listQueue(String(req.query.view || 'hidden')));
	} catch (err) {
		return fail(res, err, 'moderation_queue');
	}
};

// POST /admin/moderation/:type/:id { action: restore|approve|remove, note? }
const moderation_action = async (req, res) => {
	try {
		const result = await applyAction({
			adminId: req.user._id, type: req.params.type, id: req.params.id,
			action: req.body?.action, note: req.body?.note,
		});
		return res.status(200).json({ success: true, ...result });
	} catch (err) {
		return fail(res, err, 'moderation_action');
	}
};

module.exports = { report, moderation_queue, moderation_action };
