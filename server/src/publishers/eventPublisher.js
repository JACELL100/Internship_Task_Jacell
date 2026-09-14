require('dotenv').config();
const Redis = require('ioredis');

const publisher = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
});

const CHANNEL = 'ride-events';

/**
 * Publish a ride status change event to the Redis pub/sub channel.
 * @param {string} rideId
 * @param {string} status  - REQUESTED | ASSIGNED | NO_DRIVER_FOUND
 * @param {object} [extra] - any additional metadata
 */
async function publishEvent(rideId, status, extra = {}) {
  const payload = JSON.stringify({
    rideId,
    status,
    timestamp: new Date().toISOString(),
    ...extra,
  });
  await publisher.publish(CHANNEL, payload);
  console.log(`[Publisher] Event published → rideId=${rideId} status=${status}`);
}

module.exports = { publishEvent, CHANNEL };
