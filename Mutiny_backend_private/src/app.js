const express      = require('express');
const http         = require('http');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const mongoose     = require('mongoose');
const multer       = require('multer');
const redis        = require('./config/redis.js');
const { KAFKA_ENABLED } = require('./config/kafka.js');

const authRoutes          = require('./routes/auth.routes.js');
const ideasRoutes         = require('./routes/ideas.routes.js');
const founderRoutes       = require('./routes/founder.routes.js');
const investorRoutes      = require('./routes/investor.routes.js');
const notificationsRoutes = require('./routes/notifications.routes.js');
const feedRoutes          = require('./routes/feed.routes.js');
const teamRoutes          = require('./routes/team.routes.js');
const questionsRoutes     = require('./routes/questions.routes.js');
const adminRoutes         = require('./routes/admin.routes.js');
const reportsRoutes       = require('./routes/reports.routes.js');
const inboxRoutes         = require('./routes/inbox.routes.js');
const problemsRoutes      = require('./routes/problems.routes.js');
const leaderboardsRoutes  = require('./routes/leaderboards.routes.js');
const threadsRoutes       = require('./routes/threads.routes.js');
const agentRoutes         = require('./routes/agent.routes.js');
const { protect }         = require('./middleware/auth.middleware.js');
const { serve_attachment } = require('./controllers/ideas.controller.js');
const uploads             = require('./utils/uploads.js');

const app = express();

// Behind a load balancer or reverse proxy every request comes from the proxy's IP, so the per-IP
// limits (login, signup) would lock out everyone at once. TRUST_PROXY_HOPS = the number of proxies
// in front of the API in that deployment; unset (local), the socket address is used.
if (process.env.TRUST_PROXY_HOPS) app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));

app.use(cors({
	origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
	credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Attachments only reach people who may see the idea (X-7, X-9); avatars are public images that
// can never render as a page. Nothing else under uploads/ is served.
app.get('/uploads/ideas/:id/:filename', protect, serve_attachment);
app.use('/uploads/avatars', express.static(uploads.AVATARS_DIR, {
	index: false, dotfiles: 'deny', fallthrough: false,
	setHeaders: (res) => res.set(uploads.NO_RENDER),
}));

app.use('/auth',          authRoutes);
app.use('/ideas',         ideasRoutes);
app.use('/founder',       founderRoutes);
app.use('/investor',      investorRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/feed',          feedRoutes);
app.use('/teams',         teamRoutes);
app.use('/questions',     questionsRoutes);
app.use('/admin',         adminRoutes);
app.use('/reports',       reportsRoutes);
app.use('/inbox',         inboxRoutes);
app.use('/problems',      problemsRoutes);
app.use('/leaderboards',  leaderboardsRoutes);
app.use('/threads',       threadsRoutes);
app.use('/agent',         agentRoutes);

app.get('/health', (_, res) => {
	const mongo = mongoose.connection.readyState === 1 ? 'up' : 'down';
	res.status(mongo === 'up' ? 200 : 503).json({
		status: mongo === 'up' ? 'ok' : 'degraded',
		mongo,
		redis: redis.isReady ? 'up' : 'down',
		kafka: KAFKA_ENABLED ? 'enabled' : 'disabled (in-process events)',
	});
});

// Last-resort error handler: JSON only, never a stack trace (Express's default HTML page
// leaks one whenever NODE_ENV isn't production).
app.use((err, req, res, next) => {
	if (res.headersSent) return next(err);
	if (err instanceof multer.MulterError) {
		return res.status(400).json({ success: false, message: err.message });
	}
	if (err.type === 'entity.parse.failed') {
		return res.status(400).json({ success: false, message: 'Malformed JSON body' });
	}
	// Client errors: ours (an upload's type), body-parser's (a body too large), a missing static
	// file. Their own message only when it's meant for the client, never a system error's path.
	const status = err.status || err.statusCode;
	if (status >= 400 && status < 500) {
		const message = err.expose && !err.code ? err.message : (http.STATUS_CODES[status] || 'Bad request');
		return res.status(status).json({ success: false, message });
	}
	console.error('[Unhandled]', req.method, req.originalUrl, err);
	return res.status(err.status || 500).json({ success: false, message: 'Internal server error' });
});

module.exports = app;
