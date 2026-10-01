require('dotenv').config();

const fs       = require('fs');
const path     = require('path');
const mongoose = require('mongoose');
const app      = require('./app.js');
const internalApp = require('./internal/app.js');
const { startConsumer, stopConsumer } = require('./workers/kafkaConsumer.js');
const { disconnectProducer }          = require('./config/kafka.js');
const { connectRedis, disconnectRedis } = require('./config/redis.js');

// 5050, not 5000: macOS AirPlay Receiver (ControlCenter) already listens on 5000.
const PORT      = process.env.PORT      || 5050;
// The agent's internal API: loopback only, never on the public port.
const INTERNAL_PORT = process.env.INTERNAL_PORT || 5051;
const MONGO_URI = process.env.MONGO_URI;

for (const name of ['MONGO_URI', 'ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET']) {
	if (!process.env[name]) {
		console.error(`${name} is not set in .env (see .env.example)`);
		process.exit(1);
	}
}

// multer's diskStorage doesn't create folders; without these, uploads fail with ENOENT.
for (const dir of ['avatars', 'ideas']) {
	fs.mkdirSync(path.join(__dirname, '../uploads', dir), { recursive: true });
}





const MONGO_OPTIONS = {
	maxPoolSize:                  20,    
	minPoolSize:                  2,     
	maxIdleTimeMS:            30000,    
	serverSelectionTimeoutMS:  5000,    
	socketTimeoutMS:          45000,    
	connectTimeoutMS:         10000,    
	heartbeatFrequencyMS:     10000,    
	retryWrites:               true,    
	retryReads:                true,    
	compressors:            ['zlib'],   
};


mongoose.connection.on('connected', () => {
	console.log('[MongoDB] Connected — pool size:', MONGO_OPTIONS.maxPoolSize);
});

mongoose.connection.on('disconnected', () => {
	console.warn('[MongoDB] Disconnected');
});

mongoose.connection.on('error', (err) => {
	console.error('[MongoDB] Connection error:', err.message);
});


let server = null;
let internalServer = null;

const gracefulShutdown = async (signal) => {
	console.log(`[${signal}] Shutting down...`);
	if (server) await new Promise((resolve) => server.close(resolve));
	if (internalServer) await new Promise((resolve) => internalServer.close(resolve));
	await Promise.allSettled([
		stopConsumer(),
		disconnectProducer(),
		disconnectRedis(),
		mongoose.connection.close(),
	]);
	console.log('[Shutdown] All connections closed');
	process.exit(0);
};

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));


// Mongo is the only hard dependency. Redis (cache) and Kafka (side effects) connect in the
// background: the API serves without them and each logs its own failure.
mongoose
	.connect(MONGO_URI, MONGO_OPTIONS)
	.then(() => {
		server = app.listen(PORT, () => {
			console.log(`[Server] Running on port ${PORT} (NODE_ENV: ${process.env.NODE_ENV || 'development'})`);
		});
		if (process.env.AGENT_TO_NODE_KEY) {
			internalServer = internalApp.listen(INTERNAL_PORT, '127.0.0.1', () => {
				console.log(`[Internal] agent API on 127.0.0.1:${INTERNAL_PORT}`);
			});
		} else {
			console.log('[Internal] agent API off (AGENT_TO_NODE_KEY not set)');
		}
		connectRedis();
		startConsumer().catch((err) => {
			console.error('[Kafka] consumer failed to start — events run in-process:', err.message);
		});
	})
	.catch((err) => {
		console.error('[MongoDB] Initial connection failed:', err.message);
		process.exit(1);
	});
