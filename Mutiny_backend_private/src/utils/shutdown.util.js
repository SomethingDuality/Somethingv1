const client = require('../config/redis.js');
const mongoose = require('mongoose');

const gracefulShutdown = async(signal)=>{
    console.log('Closing all database connections');

    try{
        await Promise.all([
            mongoose.connection.close(),
            client.quit()
        ]);

        console.log('All connections closed cleanly');
        process.exit(0);
    } catch(error){
        console.log('Failed to shut down the connection');
        console.error(error);
        process.exit(1);
    }
}

process.on('SIGTERM', ()=>gracefulShutdown('SIGTERM'));
process.on('SIGINT', ()=>gracefulShutdown('SIGINT'));