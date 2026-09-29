const express = require('express');
const router  = express.Router();

const { protect } = require('../middleware/auth.middleware.js');
const { make } = require('../middleware/rateLimits.js');
const { report } = require('../controllers/reports.controller.js');

const reportLimiter = make('reports', { windowMs: 60 * 60 * 1000, limit: 10, byUser: true });

router.post('/', protect, reportLimiter, report);

module.exports = router;
