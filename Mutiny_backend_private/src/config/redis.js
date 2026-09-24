const {createClient} = require('redis');

const client = createClient({
    url: process.env.REDIS_URL,
    socket:{
        connectTimeout: 5000,
        reconnectStrategy: (retries, cause)=>{
            if(retries>10){
                console.error('Redis: Connection lost. Max retries reached');
                return new Error('Max retries reached');
            }
            const delay = Math.min(Math.pow(2, retries)*50, 2000);
            const jitter = Math.floor(Math.random()*200);

            return delay+jitter;
        },
        disableOfflineQueue: true
    }
});

// create a different client if we ever introduce financial transactions, and enable the offline queue :)
// add tls later once everything is verified and we get our own domain

client.on("error", (err)=>console.log("redis client error", err));
client.on("connect", ()=>console.log("redis is connecting"));
client.on("ready", ()=>console.log('redis is ready'));

const gracefulShutdown = async(signal)=>{
    
}

module.exports = client;