---
title: Idempotency
description: Duplicate-execution protection for mutating routes using the `IdempotencyLayer` and a Postgres-backed reservation store.
---

# Idempotency

Mutating routes are vulnerable to duplicate execution under client retries:
the network drops the response, the client retries, the handler runs twice,
the bank books two transfers. `IdempotencyLayer` solves this by atomically
reserving `(principal, key)` before the handler runs and replaying the
captured response for any subsequent request with the same key.

## Wiring

```rust
use cratestack_axum::idempotency::IdempotencyLayer;
use cratestack::SqlxIdempotencyStore;
use std::sync::Arc;
use std::time::Duration;

let store = Arc::new(SqlxIdempotencyStore::new(pool.clone()));
store.ensure_schema().await?;

let router = cratestack_schema::axum::router(db, procedures, JsonCodec, auth)
    .layer(IdempotencyLayer::new(store, Duration::from_secs(24 * 3600)));
```

The TTL is a hard upper bound on how long an in-flight reservation pins a
key. Banks running long-tail async workflows pick 24 h; consumer-facing
POST flows pick 5–60 minutes.

## Request shape

Clients opt in by sending `Idempotency-Key`:

```http
POST /transfers HTTP/1.1
Content-Type: application/json
Idempotency-Key: 7a3f-0b21-c9d4-8e15

{"from":1,"to":2,"amount":"100.00"}
```

The key must be ASCII, non-empty, and at most 255 characters. Missing keys
bypass the layer entirely — the layer is opt-in per request.

## State machine

For each request the store atomically returns one of:

1. **Reserved** — fresh claim. The handler runs and the response is persisted on completion.
2. **Replay** — a prior execution under the same key + request hash has completed. The cached response is returned with `Idempotency-Replayed: true`.
3. **InFlight** — another caller still holds the reservation. The layer returns `409 Conflict` with `Retry-After: 1`.
4. **Conflict** — the same key arrived with a different request body. The layer returns `422` with `idempotency_key_conflict`, per the IETF draft.

The request hash is SHA-256 over method, full path **including query
string**, content-type, and body. `POST /transfer?dry_run=true` and `POST
/transfer?dry_run=false` therefore hash differently — replays don't cross
query-string-encoded operation modes.

## Replay fidelity

Replays reproduce the original response's:

1. status code
2. body bytes
3. every end-to-end response header the handler set (`Location`, `ETag`, `Cache-Control`, `Set-Cookie`, `Content-Type`, …)

Hop-by-hop headers (`Connection`, `Transfer-Encoding`) and framework-computed
headers (`Content-Length`, `Date`) are filtered at capture time and not
restored. A replay carries an additional `Idempotency-Replayed: true`
header so downstream observers can distinguish it from a live execution.

## Reservation tokens

Every reservation carries a UUID `reservation_id`. `complete` and `release`
require a matching token, so a handler that runs past the TTL and has its
row reclaimed by a retry cannot poison the newer reservation. The classical
TTL-overrun scenario degrades to a silent no-op rather than a wrong-response
write.

## Principal scoping

The layer derives a principal fingerprint from the request. Two callers
sharing a key under different principals do **not** collide. The default
fingerprint is a SHA-256 of the `Authorization` header; services running
mTLS or session cookies override it:

```rust
IdempotencyLayer::new(store, ttl)
    .with_principal_fingerprint(|req| {
        req.extensions().get::<TenantId>().map(|t| t.to_string()).unwrap_or_else(|| "anonymous".to_owned())
    })
```

## Persistence

The store ships an `ensure_schema()` helper that idempotently creates the
table and index. The DDL is:

```sql
CREATE TABLE cratestack_idempotency (
    principal_fingerprint TEXT NOT NULL,
    key TEXT NOT NULL,
    request_hash BYTEA NOT NULL,
    reservation_id UUID NOT NULL,
    response_status INT,
    response_headers BYTEA,
    response_body BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (principal_fingerprint, key)
);
```

`SqlxIdempotencyStore::garbage_collect()` deletes rows whose `expires_at`
has passed. Banks call it from a scheduled task; the request path takes
over a single expired row on demand but doesn't sweep.

## Custom stores

The `IdempotencyStore` trait is async + dyn-compatible. Banks running
multi-region deployments back the trait with their own store (typically a
Postgres replica with logical replication, or a globally-consistent
key-value store) so the reservation guarantee holds across regions.

## Caveats

The single-Postgres store enforces the reservation guarantee within one
database. Banks running active-active multi-region clusters must either:

1. accept that retries hitting a different region within the TTL race the
   reservation, or
2. plug a globally-coordinated store into `IdempotencyStore` and bring
   that consensus layer's latency budget into the request path.

The shipped store also assumes a single logical service per
`principal_fingerprint`. Services that share a database between unrelated
applications should namespace the key in the fingerprint function.
