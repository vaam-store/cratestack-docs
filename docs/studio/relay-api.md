## Generated Backend API

This is the backend that each generated Studio app should ship with.

Without it, a browser UI has to solve too many platform concerns directly:

1. signed requests
2. codec choice
3. service discovery
4. auth context switching
5. cross-service routing

That is not impossible, but it is a great way to turn a UI project into a crypto-and-headers project by accident. 🫠

## Goal

Provide one small Rust backend that:

1. exposes generated metadata
2. proxies CRUD requests to CrateStack services
3. proxies procedure calls to CrateStack services
4. applies signing and transport policy on behalf of the UI
5. serves the built Yew frontend assets
6. optionally simulates auth contexts for local or internal tooling

## Production Shape

Recommended deployment shape:

1. `trunk build --release` produces static assets
2. the generated backend serves those assets
3. the generated backend mounts Studio APIs under `/studio/api`
4. the generated backend can sit behind a reverse proxy

Recommended development shape:

1. run the backend locally
2. let it serve the frontend
3. point it at the target CrateStack service URL

## Proposed Endpoints

### Static UI

```http
GET /studio
GET /studio/
GET /studio/assets/*
```

### Metadata

```http
GET /studio/api/metadata
```

### CRUD Proxy

```http
GET    /studio/api/models/:model
GET    /studio/api/models/:model/:id
POST   /studio/api/models/:model
PATCH  /studio/api/models/:model/:id
DELETE /studio/api/models/:model/:id
```

### Procedure Proxy

```http
POST /studio/api/procedures/:procedure
```

### Optional Dev Helpers

```http
POST /studio/api/context/preview
POST /studio/api/context/run-as
GET  /studio/api/routes
GET  /healthz
```

## Example Metadata Response

```json
{
  "service": "auth-service",
  "mountPath": "/studio",
  "metadata": {
    "models": ["User", "DeviceKey", "Enrollment"],
    "enums": ["EnrollmentRecordStatus", "DeviceKeyStatus"],
    "procedures": ["publicUserView"]
  }
}
```

## Example CRUD Request

```http
GET /studio/api/models/PaymentInstrument?sort=-updatedAt&status=active
```

Backend behavior:

1. translate incoming Studio query parameters into canonical CrateStack query params
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

Those turn the backend from "just a proxy" into "a developer tool".

## Security Notes

1. auth-context simulation should be dev-only or tightly restricted
2. raw signing material should not live in browser code
3. procedure execution should respect normal service auth unless an explicit trusted tooling mode is configured

The generated backend should be boring, auditable, and slightly suspicious of everyone. Which, to be fair, is a healthy attitude for admin infrastructure. 🔐

## CLI Implication

This design naturally suggests a new command such as:

```bash
cratestack generate-studio \
  --schema "../vaam-backends/services/payment-gateway/schema/payment.cool" \
  --out "../tools/studios/payment-gateway-studio" \
  --name payment-gateway-studio \
  --service-url "http://127.0.0.1:8085" \
  --mount-path "/studio"
```

That command should emit the Yew frontend, Rust backend, and deployable wrapper together.
