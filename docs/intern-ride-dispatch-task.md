## Intern Backend Task — Simple Ride Booking System

Time box: 1 day · Language: your choice · Deliverable: Git repo with a README

## What you're building

A very simplified version of how Ola/Uber assigns a ride to a driver. Three small pieces. Take them one at a time.

## Task 1 — Book a ride and offer it to a driver

Build an API: POST /rides — a rider books a ride, you return a rideId immediately.

Behind the scenes, don't process it right away. Put the ride into a queue, and have a separate worker pick it up and offer it to a driver.

Fake the driver's response — randomly accept (~50%) or reject.

- Driver accepts ride status becomes ASSIGNED

- Driver rejects offer the ride to the next driver

- After 3 rejections status becomes NO_DRIVER_FOUND

Keep a hardcoded list of ~10 fake drivers. That's enough.

## Task 2 — Publish what happened

Every time a ride's status changes (REQUESTED, ASSIGNED, NO_DRIVER_FOUND), publish that as an event.

Then write two separate small programs that both read those same events:

- Program A (billing) — prints “charging rider for ride X”

- Program B (ops) — prints “ride X is now in status Y”

Important: both programs must see every event. Not one taking some and the other taking the rest — both get all of them.

## Task 3 — Try it with 100 rides

Write a small script that books 100 rides at once. Then check and report:

| Check | Expected |
| --- | --- |
| Total rides created | 100 |
| Rides that ended ASSIGNED + NO_DRIVER_FOUND | Should add up to 100 |
| Any ride assigned to 2 drivers? | 0 |
| Any ride stuck with no final status? | 0 |

Just print these numbers at the end. A terminal table is fine — no UI needed.
