# 0007 — SSE replay and live delivery

- Status: accepted
- Date: 2026-11-23
- Milestone: M5

## Context

The server replayed events and then subscribed. An event appended between the
last replay read and the subscription was lost, and the client could not detect
or recover the gap. A silent SSE stream could also look healthy to proxies.

## Decision

- Subscribe before reading history.
- Buffer live events during replay, then flush them in seq order.
- Deduplicate by `seq`; a cursor can be replayed safely.
- Serialize all stream writes through one promise chain.
- Send an SSE comment heartbeat every 15 seconds.
- Keep `after` as the replay cursor; do not add a new event shape.

`apps/server/src/event-stream.ts` owns the replay/follow algorithm and is
tested with an event appended during replay.

## Consequences

- No event can fall between replay and live delivery.
- Heartbeats keep idle connections alive; clients ignore comment frames.
- A slow client grows the write queue because the local stream has no
  backpressure policy yet. A future limit should close the connection with a
  typed error.
- Browsers using `EventSource` would still need the bearer token via a cookie
  or a same-origin proxy; the current client uses `fetch` and a header.

## Alternatives

- Replay after subscribing without a buffer: can duplicate and reorder live
  events.
- Polling: simpler but adds latency and load.
- A separate resumable event-log endpoint: more protocol surface than this
  milestone needs.
