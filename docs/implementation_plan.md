# MERN Stack — Ride Dispatch System

A simplified Ola/Uber-style ride dispatch system with a queue-based worker, pub/sub event system, and a load-test script.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  CLIENT / SCRIPT                                                     │
│   POST /rides  →  Express API                                       │
└────────────────────┬────────────────────────────────────────────────┘
                     │ enqueue job
                     ▼
              ┌─────────────┐
              │  Bull Queue  │  (Redis-backed)
              └──────┬──────┘
                     │ worker picks job
                     ▼
              ┌─────────────────────────────────┐
              │  Worker: offer ride to driver   │
              │  • 50% accept / reject random   │
              │  • up to 3 rejections           │
              │  • updates MongoDB ride doc     │
              │  • publishes event to Redis     │
              └─────────────────────────────────┘
                     │ publish event
                     ▼
         ┌──────────────────────────┐
         │  Redis Pub/Sub channel   │
         │  "ride-events"           │
         └────────────┬─────────────┘
          ┌───────────┴───────────┐
          ▼                       ▼
    subscriber-billing.js   subscriber-ops.js
    (Program A — billing)   (Program B — ops)
```

## Tech Stack

| Layer | Technology |
|---|---|
| API Server | Node.js + Express |
| Database | MongoDB (via Mongoose) |
| Queue | Bull (Redis-backed job queue) |
| Pub/Sub | Redis native pub/sub |
| Load Test Script | Node.js script |

> [!IMPORTANT]
> **Prerequisites**: MongoDB and Redis must be running locally.
> - MongoDB: `mongod` on port 27017
> - Redis: `redis-server` on port 6379

## Project Structure

```
intern/
├── server/
│   ├── src/
│   │   ├── models/
│   │   │   └── Ride.js          # Mongoose schema
│   │   ├── queues/
│   │   │   └── rideQueue.js     # Bull queue setup
│   │   ├── workers/
│   │   │   └── rideWorker.js    # Queue consumer + driver logic
│   │   ├── publishers/
│   │   │   └── eventPublisher.js # Redis pub/sub publisher
│   │   ├── data/
│   │   │   └── drivers.js       # 10 hardcoded fake drivers
│   │   ├── routes/
│   │   │   └── rides.js         # POST /rides route
│   │   └── index.js             # Express app entry
│   ├── subscribers/
│   │   ├── billing.js           # Program A
│   │   └── ops.js               # Program B
│   ├── scripts/
│   │   └── loadTest.js          # Books 100 rides + prints report
│   ├── package.json
│   └── .env.example
└── README.md
```

## Proposed Changes

### [NEW] server/ — Node.js backend

#### [NEW] server/package.json
Express, Mongoose, Bull, ioredis, dotenv, axios dependencies.

#### [NEW] server/src/index.js
Express app with `/rides` route and MongoDB connection.

#### [NEW] server/src/models/Ride.js
Mongoose schema with fields: `riderId`, `pickup`, `dropoff`, `status` (enum: REQUESTED | ASSIGNED | NO_DRIVER_FOUND), `assignedDriver`, `attempts`.

#### [NEW] server/src/data/drivers.js
Array of 10 fake driver objects `{ id, name }`.

#### [NEW] server/src/queues/rideQueue.js
Bull queue named `ride-dispatch` connected to Redis.

#### [NEW] server/src/workers/rideWorker.js
Processes jobs from the queue:
1. Pick a random available driver
2. Fake 50% accept/reject
3. If accepted → set `ASSIGNED`, publish event
4. If rejected → increment attempts, if attempts < 3 re-enqueue with next driver, else set `NO_DRIVER_FOUND`, publish event

#### [NEW] server/src/publishers/eventPublisher.js
Redis pub/sub publisher that publishes JSON `{ rideId, status, timestamp }` to channel `ride-events`.

#### [NEW] server/src/routes/rides.js
`POST /rides` → create Ride doc in MongoDB, add job to Bull queue, return `{ rideId }`.

#### [NEW] server/subscribers/billing.js
Subscribes to `ride-events` channel. On `ASSIGNED` → prints "Charging rider for ride X".

#### [NEW] server/subscribers/ops.js
Subscribes to `ride-events` channel. Prints "Ride X is now in status Y" for all events.

#### [NEW] server/scripts/loadTest.js
- Books 100 rides via `POST /rides`
- Waits for all rides to reach a final status (polls MongoDB)
- Prints the verification table

### [NEW] README.md
Setup and run instructions.

## Verification Plan

### Automated (Task 3 script)
```bash
node server/scripts/loadTest.js
```
Expected output table:
| Check | Expected |
|---|---|
| Total rides created | 100 |
| ASSIGNED + NO_DRIVER_FOUND | 100 |
| Rides assigned to 2 drivers | 0 |
| Rides stuck with no final status | 0 |

### Manual Verification
1. Start Redis and MongoDB
2. Run `npm run dev` (API server)
3. Run worker, billing subscriber, ops subscriber in separate terminals
4. Call `POST /rides` and watch events flow through all three programs
