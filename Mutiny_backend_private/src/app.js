const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const path         = require('path');

const authRoutes          = require('./routes/auth.routes.js');
const ideasRoutes         = require('./routes/ideas.routes.js');
const founderRoutes       = require('./routes/founder.routes.js');
const investorRoutes      = require('./routes/investor.routes.js');
const notificationsRoutes = require('./routes/notifications.routes.js');
const feedRoutes          = require('./routes/feed.routes.js');
const teamRoutes          = require('./routes/team.routes.js');

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

app.get('/health', (_, res) => res.json({ status: 'ok' }));

module.exports = app;
