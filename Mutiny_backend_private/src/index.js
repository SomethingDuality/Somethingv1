require('dotenv').config();

const mongoose = require('mongoose');
const app      = require('./app.js');

const PORT      = process.env.PORT      || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
	console.error('MONGO_URI is not set in .env');
	process.exit(1);
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


const gracefulShutdown = async (signal) => {
	console.log(`[${signal}] Closing MongoDB connection pool...`);
	await mongoose.connection.close();
	console.log('[MongoDB] Connection pool closed');
	process.exit(0);
};

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));


mongoose
	.connect(MONGO_URI, MONGO_OPTIONS)
	.then(() => {
		app.listen(PORT, () => {
			console.log(`[Server] Running on port ${PORT} (NODE_ENV: ${process.env.NODE_ENV || 'development'})`);
		});
	})
	.catch((err) => {
		console.error('[MongoDB] Initial connection failed:', err.message);
		process.exit(1);
	});
