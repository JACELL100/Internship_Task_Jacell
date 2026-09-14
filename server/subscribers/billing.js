require('dotenv').config();
const Redis = require('ioredis');
const { CHANNEL } = require('../src/publishers/eventPublisher');

const subscriber = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
});

subscriber.subscribe(CHANNEL, (err, count) => {
  if (err) {
    console.error('[Billing] Failed to subscribe:', err.message);
    process.exit(1);
  }
  console.log(`[Billing] Subscribed to "${CHANNEL}" ✓`);
  console.log('[Billing] Waiting for ride events...\n');
});

subscriber.on('message', (_channel, message) => {
  try {
    const event = JSON.parse(message);

    // Billing only cares about completed rides
    if (event.status === 'ASSIGNED') {
      console.log(
        `[Billing] 💳 Charging rider for ride ${event.rideId}` +
          (event.driver ? ` (assigned to ${event.driver.name})` : '') +
          ` at ${event.timestamp}`
      );
    }
  } catch (err) {
    console.error('[Billing] Failed to parse event:', err.message);
  }
});

subscriber.on('error', (err) => {
  console.error('[Billing] Redis error:', err.message);
});
