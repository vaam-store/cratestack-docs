---
title: RPC transport
description: Pick `transport rpc` in your `.cstack` schema to swap REST routes for `POST /rpc/{op_id}` + `POST /rpc/batch`. Unary, batch, and streaming work today; WebSocket + subscriptions are designed but not yet built.
---

# RPC transport

CrateStack ships **two generation styles** for a `.cstack` schema. The default is REST — per-model `/users`, `/users/{id}`, `/$procs/<name>` routes, the shape this framework was built around. The alternative is **RPC** — a single `POST /rpc/{op_id}` route per callable, a `POST /rpc/batch` endpoint that takes N frames at a time, and content-negotiated streaming on the same unary route. One binding per schema; the macro emits exactly one binding's worth of routes and client surface. There is no runtime flip and no schema runs both.

This guide covers what the RPC binding does today and when to pick it. The full design is in [ADR 0005](../internals/rpc-transport-adr).

## Pick the binding

Declare the directive at the top of your `.cstack` file:

```cstack
transport rpc

datasource db {
  provider = "postgresql"
  url = env("DATABASE_URL")
}

auth Operator {
  id Int
}

model Widget {
  id Int @id
  name String

  @@allow("read", auth() != null)
  @@allow("create", auth() != null)
  @@allow("update", auth() != null)
  @@allow("delete", auth() != null)
}

procedure ping(args: PingArgs): PingArgs
  @allow(auth() != null)
```

Omit the directive for REST behavior unchanged. Defaults preserve everything written before the directive existed.

## Mounting the router

`include_server_schema!` emits an `rpc_router(...)` builder when `transport rpc` is set, same shape as the existing `model_router` / `procedure_router`:

```rust
use cratestack::axum::Router;

let app: Router = cratestack_schema::axum::rpc_router(
    db,
    MyProcedures,
    CodecSet::new(CborCodec, JsonCodec),
    MyAuthProvider,
);
```

The router mounts two paths:

- `POST /rpc/{op_id}` — unary for every CRUD verb + every procedure
- `POST /rpc/batch` — sequence of `RpcRequest` frames

## Op identity

Every callable in a `transport rpc` schema gets a stable dotted id. The id is the only dispatch key and appears in the URL:

| Schema construct | Op id | Kind |
|---|---|---|
| `model Widget` | `model.Widget.list` | `Unary` |
| `model Widget` | `model.Widget.get` | `Unary` |
| `model Widget` | `model.Widget.create` | `Unary` |
| `model Widget` | `model.Widget.update` | `Unary` |
| `model Widget` | `model.Widget.delete` | `Unary` |
| `procedure ping(...)` | `procedure.ping` | `Unary` |
| `procedure manyPings(...): PingArgs[]` | `procedure.manyPings` | `Sequence` |

The op id appearing in the URL (not the body) is deliberate — it lets nginx, CDNs, and HTTP tracing tools route and instrument per-op without parsing payloads.

## Unary

Body shape per verb:

```jsonc
// POST /rpc/model.Widget.create
// body = CreateWidgetInput directly (same as the REST POST body shape)
{ "name": "left handle" }

// POST /rpc/model.Widget.get  or  /rpc/model.Widget.delete
{ "id": 42 }

// POST /rpc/model.Widget.update
// patch decoded against the model's UpdateWidgetInput shape
{ "id": 42, "patch": { "name": "new name" } }

// POST /rpc/model.Widget.list
// mirrors the REST URL query 1:1 — same keys, same semantics
{
  "limit": 20,
  "offset": 40,
  "fields": ["id", "name"],
  "include": ["..."],
  "sort": "name desc",
  "where": "...",
  "filters": [{ "key": "active", "value": "true" }]
}

// POST /rpc/procedure.ping
// body = procedure Args directly
{ "args": { "nonce": "abc" } }
```

Response on success: the codec-encoded output directly (no envelope wrapper). Auth, codec negotiation, content-type rules — same as the REST binding.

## Batch — `POST /rpc/batch`

Send N requests in one round-trip, get N responses back **in the same order**:

```jsonc
// request body — a sequence of RpcRequest frames
[
  { "id": 1, "op": "procedure.ping",       "input": { "args": { "nonce": "a" } } },
  { "id": 2, "op": "model.Widget.create",  "input": { "name": "frame two" }, "idem": "client-key-7b3" },
  { "id": 3, "op": "model.Widget.get",     "input": { "id": 42 } }
]
```

```jsonc
// response body — a sequence of RpcResponseFrame, same order as the request
[
  { "id": 1, "output": { "nonce": "a" } },
  { "id": 2, "output": { "id": 17, "name": "frame two" } },
  { "id": 3, "error":  { "code": "not_found", "message": "widget 42" } }
]
```

Three deliberate behaviors:

1. **Per-frame errors don't poison the batch.** The envelope returns `200 OK` as long as the batch parsed; each frame's success or failure is on its own response frame.
2. **No transactional mode, no in-batch dependencies.** Each frame runs in its own transaction. A batch like `[create A, update B referencing A.id]` is not supported — use two roundtrips or a single `@procedure` that owns the composite operation.
3. **Per-frame idempotency only.** Send `idem` on each `RpcRequest`. The `Idempotency-Key` HTTP header is rejected on `/rpc/batch` as ambiguous.

A malformed batch envelope (body that isn't a sequence of frames) returns `400`.

## Streaming — `Accept: application/cbor-seq`

List-return procedures (those declared as `... : T[]`) get `OpKind::Sequence` from the macro and stream over the **same** `POST /rpc/{op_id}` route as unary. Switch by content negotiation:

```http
POST /rpc/procedure.manyPings HTTP/1.1
Content-Type: application/cbor
Accept: application/cbor-seq
```

The response is a stream of codec-encoded chunks, terminated by end-of-body. With the default Accept the same op returns a single CBOR `Vec<T>` — the route doesn't change, only the wire shape.

SSE (`text/event-stream`) is wired in the codec layer and works the same way for clients that need EventSource compatibility.

## Errors — uniform `RpcErrorBody` shape

Every error on the RPC binding — whether raised inside the dispatcher (decode failure, unknown op id) or inside a handler (auth denied, not found, validation failed) — wire-shapes as:

```jsonc
{
  "code": "not_found",
  "message": "widget 42",
  "details": null
}
```

The `code` field uses **gRPC-style lowercase strings**: `not_found`, `invalid_argument`, `permission_denied`, `failed_precondition`, `conflict`, `unauthenticated`, `internal`. Never the REST binding's `SCREAMING_CASE` (`NOT_FOUND`, `FORBIDDEN`, …).

HTTP status codes match the error category. Clients that catch by status work unchanged from REST; clients that parse the body get a stable string vocabulary.

## When to pick RPC

| You want | Pick |
|---|---|
| Cacheable GETs, per-route metrics, REST tooling ecosystem | `transport rest` |
| Multi-op batching in one round-trip | `transport rpc` |
| One uniform error vocabulary across every op | `transport rpc` |
| List/audit/feed streaming with a single content-type flip | Either — REST and RPC both serve `application/cbor-seq` on list-return shapes |
| Subscriptions / push channels | Neither yet (see below) |
| Server-to-server only, prefer one consistent op-id namespace | `transport rpc` |
| Public API that benefits from HTTP-native caching at a CDN | `transport rest` |

Schemas can't switch styles without migrating clients, so pick deliberately. If you're unsure, REST is the back-compat default.

## What's not yet built — WebSocket + subscriptions

The HTTP surface of the RPC binding is feature-complete. The remaining direction is a **WebSocket binding** that would unlock subscriptions — `model.<X>.subscribe` ops that stream `ModelEvent<X>` frames over a long-lived channel. The wire-side design is captured in [ADR 0005 §3.4](../internals/rpc-transport-adr); the runtime work is gated on a concrete subscription use case.

Streaming shipped without ceremony because the shape was concrete — list-return procedures, audit feeds, paginated reads, all naturally producing finite sequences with an existing encoder ready to go. Subscriptions don't have that profile yet: CrateStack's audit and event-bus consumers today are server-to-server and poll or consume from the audit sink. External clients are the natural fit, but no concrete CrateStack consumer is asking for subscriptions right now. **When a concrete use case appears, the WS binding becomes the next cool upgrade.** Until then, the gap is deliberate.

## Read Next

1. [ADR 0005: RPC Binding for `transport rpc` schemas](../internals/rpc-transport-adr) — the canonical design, including the design decisions made along the way (URL routing, dispatcher delegation, error wire shape) and the deferred items.
2. [Transport architecture](../architecture/transport-architecture) — the codec / framing / envelope model that both bindings sit on top of.
3. [Idempotency](./idempotency), [Batches](./batches) — closely related primitives that work the same way on either binding.
