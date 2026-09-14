require('dotenv').config();
const mongoose = require('mongoose');
const Ride = require('../src/models/Ride');
const rideQueue = require('../src/queues/rideQueue');
const { publishEvent } = require('../src/publishers/eventPublisher');
const DRIVERS = require('../src/data/drivers');

const MAX_REJECTIONS = 3;

// ─── Connect to MongoDB ───────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ride-dispatch')
  .then(() => console.log('[Worker] MongoDB connected ✓'))
  .catch((err) => {
    console.error('[Worker] MongoDB connection failed:', err.message);
    process.exit(1);
  });

// ─── Helper: pick a driver not yet offered this ride ─────────────────────────
function pickDriver(offeredDriverIds) {
  const available = DRIVERS.filter((d) => !offeredDriverIds.includes(d.id));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

// ─── Helper: simulate driver response (50/50) ────────────────────────────────
function driverAccepts() {
  return Math.random() < 0.5;
}

// ─── Queue Worker ─────────────────────────────────────────────────────────────
rideQueue.process(async (job) => {
  const { rideId } = job.data;

  const ride = await Ride.findById(rideId);
  if (!ride) {
    console.error(`[Worker] Ride ${rideId} not found`);
    return;
  }

  // Already in a terminal state (shouldn't happen, but guard anyway)
  if (ride.status === 'ASSIGNED' || ride.status === 'NO_DRIVER_FOUND') {
    console.log(`[Worker] Ride ${rideId} already settled (${ride.status}), skipping.`);
    return;
  }

  const driver = pickDriver(ride.offeredDriverIds);

  if (!driver) {
    // All drivers have been tried → no driver found
    ride.status = 'NO_DRIVER_FOUND';
    await ride.save();
    await publishEvent(rideId, 'NO_DRIVER_FOUND');
    console.log(`[Worker] Ride ${rideId} → NO_DRIVER_FOUND (all drivers tried)`);
    return;
  }

  // Record that we've offered this ride to the driver
  ride.offeredDriverIds.push(driver.id);
  ride.attempts += 1;
  await ride.save();

  console.log(
    `[Worker] Offering ride ${rideId} to ${driver.name} (attempt ${ride.attempts})`
  );

  const accepted = driverAccepts();

  if (accepted) {
    // ── Driver accepts ──────────────────────────────────────────────────────
    ride.status = 'ASSIGNED';
    ride.assignedDriver = driver;
    await ride.save();
    await publishEvent(rideId, 'ASSIGNED', { driver });
    console.log(`[Worker] Ride ${rideId} → ASSIGNED to ${driver.name}`);
  } else {
    // ── Driver rejects ──────────────────────────────────────────────────────
    console.log(`[Worker] ${driver.name} rejected ride ${rideId}`);

    if (ride.attempts >= MAX_REJECTIONS) {
      // Exhausted all allowed rejections
      ride.status = 'NO_DRIVER_FOUND';
      await ride.save();
      await publishEvent(rideId, 'NO_DRIVER_FOUND');
      console.log(`[Worker] Ride ${rideId} → NO_DRIVER_FOUND (3 rejections)`);
    } else {
      // Re-enqueue for next driver attempt
      await rideQueue.add(
        { rideId },
        { attempts: 1, removeOnComplete: true, removeOnFail: false }
      );
      console.log(`[Worker] Ride ${rideId} re-queued for next driver`);
    }
  }
});

rideQueue.on('error', (err) => {
  console.error('[Worker] Queue error:', err.message);
});

console.log('[Worker] Listening for ride dispatch jobs...');
