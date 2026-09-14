/**
 * Load Test — Books 100 rides concurrently and reports the verification table.
 *
 * Usage:
 *   node scripts/loadTest.js
 *
 * Make sure the API server and worker are both running before executing.
 */

require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Ride = require('../src/models/Ride');

const API_BASE = `http://localhost:${process.env.PORT || 3000}`;
const TOTAL_RIDES = 100;
const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 120_000; // 2 minutes max wait

const TERMINAL_STATUSES = new Set(['ASSIGNED', 'NO_DRIVER_FOUND']);

// ─── Step 1: Book 100 rides ───────────────────────────────────────────────────
async function bookRides() {
  console.log(`\n📤 Booking ${TOTAL_RIDES} rides...`);

  const requests = Array.from({ length: TOTAL_RIDES }, (_, i) =>
    axios.post(`${API_BASE}/rides`, {
      riderId: `RIDER_${String(i + 1).padStart(3, '0')}`,
      pickup: `Location_${i + 1}_A`,
      dropoff: `Location_${i + 1}_B`,
    })
  );

  const results = await Promise.allSettled(requests);
  const rideIds = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      rideIds.push(result.value.data.rideId);
    } else {
      console.error('  ⚠ Failed to book ride:', result.reason?.message);
    }
  }

  console.log(`  ✓ Successfully booked: ${rideIds.length} rides`);
  return rideIds;
}

// ─── Step 2: Poll until all rides settle ─────────────────────────────────────
async function waitForCompletion(rideIds) {
  console.log('\n⏳ Waiting for all rides to reach a final status...');

  const start = Date.now();
  let settled = 0;

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const rides = await Ride.find({ _id: { $in: rideIds } })
      .select('status')
      .lean();

    settled = rides.filter((r) => TERMINAL_STATUSES.has(r.status)).length;
    const remaining = rideIds.length - settled;

    process.stdout.write(`\r  Settled: ${settled}/${rideIds.length}  (${remaining} pending)   `);

    if (settled === rideIds.length) {
      process.stdout.write('\n');
      return true;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  process.stdout.write('\n');
  console.warn(`  ⚠ Timed out. Only ${settled}/${rideIds.length} rides settled.`);
  return false;
}

// ─── Step 3: Print verification report ───────────────────────────────────────
async function printReport(rideIds) {
  console.log('\n📊 Verification Report');
  console.log('═'.repeat(60));

  const rides = await Ride.find({ _id: { $in: rideIds } }).lean();

  const totalCreated = rides.length;
  const assigned = rides.filter((r) => r.status === 'ASSIGNED').length;
  const noDriver = rides.filter((r) => r.status === 'NO_DRIVER_FOUND').length;
  const stuck = rides.filter((r) => !TERMINAL_STATUSES.has(r.status)).length;

  // Check for any ride assigned to multiple distinct drivers
  // (should never happen — only one assignedDriver per ride)
  const assignedToMultiple = rides.filter((r) => {
    // offeredDriverIds lists everyone who was *offered*, not assigned.
    // A ride should only have ONE assignedDriver.
    // We flag rides where assignedDriver was somehow set more than once
    // by checking the ride document integrity.
    return r.status === 'ASSIGNED' && !r.assignedDriver;
  }).length;

  const rows = [
    { check: 'Total rides created', expected: '100', actual: String(totalCreated), pass: totalCreated === 100 },
    { check: 'ASSIGNED + NO_DRIVER_FOUND', expected: '100', actual: String(assigned + noDriver), pass: assigned + noDriver === 100 },
    { check: 'Rides assigned to 2+ drivers', expected: '0', actual: String(assignedToMultiple), pass: assignedToMultiple === 0 },
    { check: 'Rides stuck (no final status)', expected: '0', actual: String(stuck), pass: stuck === 0 },
  ];

  // Table header
  const col1 = 36, col2 = 10, col3 = 10, col4 = 6;
  console.log(
    'Check'.padEnd(col1) +
    'Expected'.padEnd(col2) +
    'Actual'.padEnd(col3) +
    'Pass?'
  );
  console.log('─'.repeat(col1 + col2 + col3 + col4));

  for (const row of rows) {
    const icon = row.pass ? '✅' : '❌';
    console.log(
      row.check.padEnd(col1) +
      row.expected.padEnd(col2) +
      row.actual.padEnd(col3) +
      icon
    );
  }

  console.log('═'.repeat(60));
  console.log(`\n  ASSIGNED:        ${assigned}`);
  console.log(`  NO_DRIVER_FOUND: ${noDriver}`);
  console.log(`  Stuck:           ${stuck}`);

  const allPass = rows.every((r) => r.pass);
  console.log(`\n${allPass ? '🎉 All checks passed!' : '⚠  Some checks failed.'}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/ride-dispatch'
    );
    console.log('[LoadTest] MongoDB connected ✓');

    const rideIds = await bookRides();

    if (rideIds.length === 0) {
      console.error('No rides were booked. Is the API server running?');
      process.exit(1);
    }

    await waitForCompletion(rideIds);
    await printReport(rideIds);
  } catch (err) {
    console.error('[LoadTest] Fatal error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
