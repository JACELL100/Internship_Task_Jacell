require('dotenv').config();
const Bull = require('bull');

const rideQueue = new Bull('ride-dispatch', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
  },
});

module.exports = rideQueue;
