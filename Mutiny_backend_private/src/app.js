const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const path         = require('path');
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

const app = express();

app.use(cors({
	origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
	credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/auth',          authRoutes);
app.use('/ideas',         ideasRoutes);
app.use('/founder',       founderRoutes);
app.use('/investor',      investorRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/feed',          feedRoutes);
app.use('/teams',         teamRoutes);
app.use('/questions',     questionsRoutes);
app.use('/admin',         adminRoutes);

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
	console.error('[Unhandled]', req.method, req.originalUrl, err);
	return res.status(err.status || 500).json({ success: false, message: 'Internal server error' });
});

module.exports = app;
