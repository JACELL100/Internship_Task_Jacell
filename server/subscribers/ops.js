require('dotenv').config();
const Redis = require('ioredis');
const { CHANNEL } = require('../src/publishers/eventPublisher');

const subscriber = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
});

subscriber.subscribe(CHANNEL, (err, count) => {
  if (err) {
    console.error('[Ops] Failed to subscribe:', err.message);
    process.exit(1);
  }
  console.log(`[Ops] Subscribed to "${CHANNEL}" ✓`);
  console.log('[Ops] Waiting for ride events...\n');
});

subscriber.on('message', (_channel, message) => {
  try {
    const event = JSON.parse(message);

    const statusIcon = {
      REQUESTED: '📋',
      ASSIGNED: '✅',
      NO_DRIVER_FOUND: '❌',
    }[event.status] || '🔔';

    console.log(
      `[Ops] ${statusIcon} Ride ${event.rideId} is now in status ${event.status}` +
        ` at ${event.timestamp}`
    );
  } catch (err) {
    console.error('[Ops] Failed to parse event:', err.message);
  }
});

subscriber.on('error', (err) => {
  console.error('[Ops] Redis error:', err.message);
});
