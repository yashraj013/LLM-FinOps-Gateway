import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

redisClient.on('connect', () => {
  console.log('Redis connected');
});

redisClient.on('error', (error) => {
  console.error('Redis Client Error:', error.message);
});

export const connectRedis = async () => {
  try {
    if (redisClient.status !== 'ready') {
      await redisClient.connect();
    }
    return redisClient;
  } catch (error) {
    console.error(`Error connecting to Redis: ${error.message}`);
    process.exit(1);
  }
};

export default redisClient;