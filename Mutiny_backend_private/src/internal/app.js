// A second Express app for service-to-service calls from the agent. It listens on 127.0.0.1
// (INTERNAL_PORT, 5051) and is never mounted on the public app: no cookies, no CORS, key only.
const express = require('express');
const { requireAgentKey } = require('../middleware/serviceAuth.middleware.js');
const internalRoutes = require('../routes/internal.routes.js');

const internalApp = express();
internalApp.disable('x-powered-by');
internalApp.use(express.json({ limit: '256kb' }));
internalApp.use('/internal', requireAgentKey, internalRoutes);
internalApp.use((req, res) => res.status(404).json({ success: false }));
internalApp.use((err, req, res, next) => {
	if (res.headersSent) return next(err);
	if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Malformed JSON body' });
	console.error('[internal]', req.method, req.originalUrl, err?.message);
	return res.status(500).json({ success: false, message: 'Internal server error' });
});

module.exports = internalApp;
