const redis = require('redis');

let client = null;

async function connectRedis() {
  if (client?.isOpen) {
    console.log('Using existing Redis connection');
    return client;
  }

  try {
    client = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    client.on('error', (err) => {
      console.error('Redis error:', err);
    });

    client.on('connect', () => {
      console.log('Redis connected');
    });

    client.on('reconnecting', () => {
      console.log('Redis reconnecting...');
    });

    client.on('end', () => {
      console.log('Redis connection closed');
    });

    await client.connect();

    // Test connection
    await client.ping();

    return client;
  } catch (error) {
    console.error('Redis connection failed:', error);
    throw error;
  }
}

function getRedisClient() {
  if (!client?.isOpen) {
    throw new Error('Redis client not connected');
  }
  return client;
}

async function disconnectRedis() {
  if (client?.isOpen) {
    await client.quit();
    console.log('Redis disconnected');
  }
}

module.exports = {
  connectRedis,
  getRedisClient,
  disconnectRedis
};
