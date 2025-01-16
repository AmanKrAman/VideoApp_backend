import Redis from 'ioredis';

const redisClient = new Redis();

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

redisClient.on('ready', () => {
  console.log('Redis Client is ready');
});

export default redisClient;
