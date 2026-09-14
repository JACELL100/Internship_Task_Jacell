const mongoose = require('mongoose');

const RideSchema = new mongoose.Schema(
  {
    riderId: {
      type: String,
      required: true,
    },
    pickup: {
      type: String,
      required: true,
    },
    dropoff: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['REQUESTED', 'ASSIGNED', 'NO_DRIVER_FOUND'],
      default: 'REQUESTED',
    },
    assignedDriver: {
      type: Object,
      default: null,
    },
    // Track which driver IDs have already been offered this ride
    offeredDriverIds: {
      type: [String],
      default: [],
    },
    attempts: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ride', RideSchema);
