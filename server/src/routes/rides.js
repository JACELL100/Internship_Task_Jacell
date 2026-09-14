const express = require('express');
const router = express.Router();
const Ride = require('../models/Ride');
const rideQueue = require('../queues/rideQueue');
const { publishEvent } = require('../publishers/eventPublisher');

// POST /rides — book a ride
router.post('/', async (req, res) => {
  try {
    const { riderId, pickup, dropoff } = req.body;

    if (!riderId || !pickup || !dropoff) {
      return res.status(400).json({
        error: 'riderId, pickup, and dropoff are required.',
      });
    }

    // 1. Create the ride document in MongoDB
    const ride = await Ride.create({
      riderId,
      pickup,
      dropoff,
      status: 'REQUESTED',
    });

    // 2. Publish initial REQUESTED event
    await publishEvent(ride._id.toString(), 'REQUESTED', { riderId, pickup, dropoff });

    // 3. Enqueue the dispatch job — worker picks it up asynchronously
    await rideQueue.add(
      { rideId: ride._id.toString() },
      {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    // 4. Return rideId immediately — no waiting for driver assignment
    return res.status(201).json({
      rideId: ride._id.toString(),
      status: ride.status,
      message: 'Ride booked. Driver is being assigned.',
    });
  } catch (err) {
    console.error('[POST /rides] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /rides/:id — check ride status
router.get('/:id', async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id).lean();
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    return res.json(ride);
  } catch (err) {
    console.error('[GET /rides/:id] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
