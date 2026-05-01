## Relay API

This is the "make Studio practical" layer.

Without a relay, a browser UI has to solve too many platform concerns directly:

1. signed requests
2. codec choice
3. service discovery
4. auth context switching
5. cross-service routing

That is not impossible, but it is a great way to turn a UI project into a crypto-and-headers project by accident. 🫠

## Goal

Provide one HTTP relay that:

1. exposes generated metadata
2. proxies CRUD requests to CoolStack services
3. proxies procedure calls to CoolStack services
4. applies signing and transport policy on behalf of the UI
5. optionally simulates auth contexts for local or internal tooling

## Deployment Shapes

Three viable shapes exist:

1. dev-local relay for local Studio work
2. service-local relay mode for backend developers
3. `vaam-admin` server-side relay for internal tooling

Recommended starting point:

1. local relay in development
2. admin-side relay for shared internal environments

## Proposed Endpoints

### Metadata

```http
GET /studio/services
GET /studio/services/:service/metadata
```

### CRUD Proxy

```http
GET    /studio/services/:service/models/:model
GET    /studio/services/:service/models/:model/:id
POST   /studio/services/:service/models/:model
PATCH  /studio/services/:service/models/:model/:id
DELETE /studio/services/:service/models/:model/:id
```

### Procedure Proxy

```http
POST /studio/services/:service/procedures/:procedure
```

### Optional Dev Helpers

```http
POST /studio/context/preview
POST /studio/context/run-as
GET  /studio/routes
```

## Example Metadata Response

```json
{
  "service": "auth-service",
  "metadata": {
    "models": ["User", "DeviceKey", "Enrollment"],
    "enums": ["EnrollmentRecordStatus", "DeviceKeyStatus"],
    "procedures": ["publicUserView"]
  }
}
```

## Example CRUD Request

```http
GET /studio/services/payment-gateway/models/PaymentInstrument?sort=-updatedAt&status=active
```

Relay behavior:

1. translate incoming Studio query parameters into canonical CoolStack query params
2. sign if needed
3. forward using the configured transport codec
4. return a normalized JSON response to the UI

## Example Procedure Request

```json
{
  "args": {
    "paymentInstrumentId": "pi_123"
  },
  "context": {
    "mode": "service"
  }
}
```

## Response Shape

Keep the UI response predictable:

```json
{
  "ok": true,
  "service": "payment-gateway",
  "resource": "PaymentInstrument",
  "data": {
    "id": "pi_123",
    "status": "inactive"
  },
  "meta": {
    "codec": "cbor",
    "signed": true,
    "route": "/payment-instruments/pi_123"
  }
}
```

## Studio-Specific Extras Worth Adding

1. request inspector payload
2. response inspector payload
3. effective route info
4. effective auth-context info
5. raw error body on non-success

Those turn the relay from "just a proxy" into "a developer tool".

## Security Notes

1. auth-context simulation should be dev-only or tightly restricted
2. raw signing material should not live in browser code
3. procedure execution should respect normal service auth unless an explicit trusted tooling mode is configured

The relay should be boring, auditable, and slightly suspicious of everyone. Which, to be fair, is a healthy attitude for admin infrastructure. 🔐
