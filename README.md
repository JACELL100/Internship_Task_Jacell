# Ride Dispatch System

A simplified Ola/Uber-style ride dispatch system built with Node.js, Express, MongoDB, Bull (Redis queue), and Redis Pub/Sub.

## Architecture

```
POST /rides
    │
    ▼
MongoDB (Ride doc created)
    │
    ▼
Bull Queue (Redis-backed)
    │
    ▼
Worker Process
  ├── Picks random driver (not yet offered)
  ├── 50% accept / 50% reject
  ├── If accepted  → status = ASSIGNED
  ├── If rejected  → re-queue (max 3 tries)
  └── If 3 rejects → status = NO_DRIVER_FOUND
    │
    ▼
Redis Pub/Sub ("ride-events" channel)
    ├── billing.js  → prints charge message  (Program A)
    └── ops.js      → prints status update   (Program B)
```

## Prerequisites

- **Node.js** v18+
- **MongoDB** running on `localhost:27017`
- **Redis** (or Memurai on Windows) running on `localhost:6379`

## Setup

```bash
cd server
npm install
```

Copy the environment file:
```bash
cp .env.example .env
```

## Running

Open **4 separate terminals** inside `server/`:

### Terminal 1 — API Server
```bash
npm run dev
```

### Terminal 2 — Dispatch Worker
```bash
npm run worker
```

### Terminal 3 — Program A (Billing)
```bash
npm run billing
```

### Terminal 4 — Program B (Ops)
```bash
npm run ops
```

## Test a Single Ride

```bash
curl -X POST http://localhost:3000/rides \
  -H "Content-Type: application/json" \
  -d '{"riderId":"RIDER_001","pickup":"MG Road","dropoff":"Koramangala"}'
```

Check status:
```bash
curl http://localhost:3000/rides/<rideId>
```

## Task 3 — Load Test (100 Rides)

With all 4 processes running:

```bash
npm run load-test
```

Expected output:
```
Check                                Expected  Actual    Pass?
────────────────────────────────────────────────────────────
Total rides created                  100       100       ✅
ASSIGNED + NO_DRIVER_FOUND           100       100       ✅
Rides assigned to 2+ drivers         0         0         ✅
Rides stuck (no final status)        0         0         ✅
```

## Project Structure

```
server/
├── src/
│   ├── index.js                # Express app (API server)
│   ├── models/Ride.js          # Mongoose schema
│   ├── data/drivers.js         # 10 fake hardcoded drivers
│   ├── queues/rideQueue.js     # Bull queue
│   ├── publishers/
│   │   └── eventPublisher.js   # Redis pub/sub publisher
│   ├── routes/rides.js         # POST /rides, GET /rides/:id
│   └── workers/rideWorker.js   # Dispatch worker
├── subscribers/
│   ├── billing.js              # Program A
│   └── ops.js                  # Program B
├── scripts/
│   └── loadTest.js             # 100-ride load test + report
├── .env.example
└── package.json
```

## API Reference

### `POST /rides`
Book a new ride.

**Body:**
```json
{
  "riderId": "RIDER_001",
  "pickup": "MG Road",
  "dropoff": "Koramangala"
}
```

**Response (201):**
```json
{
  "rideId": "664abc123...",
  "status": "REQUESTED",
  "message": "Ride booked. Driver is being assigned."
}
```

### `GET /rides/:id`
Check the current status of a ride.

**Response:**
```json
{
  "_id": "664abc123...",
  "riderId": "RIDER_001",
  "status": "ASSIGNED",
  "assignedDriver": { "id": "DRV003", "name": "Rahul Mehta" },
  "attempts": 2
}
```
