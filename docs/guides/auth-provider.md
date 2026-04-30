# Auth Provider

CrateStack does not authenticate requests itself.

The host application is responsible for:

* reading headers, cookies, bearer tokens, signed requests, or other transport-specific auth material
* validating that material
* projecting the authenticated principal into a CrateStack auth context

The framework boundary for that is `coolstack::AuthProvider`.

## Trait shape

Implement one trait per host auth strategy:

```rust
use coolstack::{AuthProvider, CoolContext, RequestContext};

#[derive(Clone)]
struct AppAuthProvider;

impl AuthProvider for AppAuthProvider {
    type Error = coolstack::CoolError;

    fn authenticate(
        &self,
        request: &RequestContext<'_>,
    ) -> impl core::future::Future<Output = Result<CoolContext, Self::Error>> + Send {
        let result = resolve_context_from_request(request);
        core::future::ready(result)
    }
}
```

`RequestContext` gives the provider a framework-owned request view:

* `method`
* `path`
* `query`
* `headers`
* `body`

This keeps auth resolution outside generated handlers while avoiding direct dependency on a specific host framework request type.

## Router usage

Register the provider once when building generated routes:

```rust
let router = coolstack_schema::axum::router(
    db,
    procedures,
    CborCodec,
    AppAuthProvider,
);
```

Generated CRUD and procedure routes will call `authenticate(...)` for each request and use the resulting `CoolContext` for schema policy enforcement.

## Internal callers

Non-HTTP Rust callers can bind auth directly:

```rust
let bound = db.bind_auth(Some(serde_json::json!({
    "id": 7,
    "role": "admin",
})))?;

let posts = bound.post().find_many().run().await?;
```

Use `bind_context(...)` when the host already has a `CoolContext`.

## Principal projection

`bind_auth(...)` accepts any `serde::Serialize` principal that serializes to a JSON object.

Example:

```rust
#[derive(serde::Serialize)]
struct Principal {
    id: String,
    role: String,
    tenant_id: String,
}
```

That object is normalized into a `CoolContext` principal surface with two layers:

* a structured principal model with `actor`, `session`, `tenant`, and free-form `claims`
* a legacy auth projection so existing `auth().field` policies keep working

Schema expressions can continue to use the familiar `auth()` shape:

```cool
@@allow("read", auth() != null && published)
@@allow("update", authorId == auth().id)
@@allow("delete", auth().role == "admin")
@@allow('all', auth() != null && auth().id == authorId)
@@deny('all', auth().organization.id != organizationId)
organizationId String? @default(auth().organization.id)
```

Structured principals can also carry first-class facets explicitly:

```rust
#[derive(serde::Serialize)]
struct Principal {
    actor: Actor,
    session: Session,
    tenant: Tenant,
    role: String,
}
```

When those top-level keys are present, `CoolContext::from_principal(...)` promotes them into the structured `principal.actor`, `principal.session`, and `principal.tenant` slots while still projecting the same data back through legacy `auth()` lookups for schema compatibility.

Current auth-derived create defaults are intentionally conservative:

* `@default(auth().field)` only
* nested auth paths like `@default(auth().organization.id)` are supported
* no arbitrary expressions or function calls inside `@default(...)`
* currently limited to `String`/`Cuid`, `Int`, and `Boolean` model fields

For the broader supported policy matrix, precedence rules, and explicit not-supported cases, see `../reference/auth-support-matrix.md`.

## Compatibility note

Exact auth keys still win before dotted traversal.

That means older flat claim maps such as `organizationId` can continue to work even while newer principals project nested structures such as `tenant.id` or `organization.id`.

The recommended direction for new integrations is:

* prefer structured principals with top-level `actor`, `session`, and `tenant` objects when those concepts exist
* treat ad hoc top-level scalar claims as compatibility or app-specific extensions rather than the long-term principal shape

CrateStack still accepts the older header-only resolver closure shape:

```rust
Fn(&HeaderMap) -> Result<CoolContext, CoolError>
```

through a compatibility blanket implementation.

Treat that closure form as legacy compatibility only.

New code should use an explicit `AuthProvider` type so auth behavior stays discoverable and reusable across routers, tests, and internal service boundaries.
