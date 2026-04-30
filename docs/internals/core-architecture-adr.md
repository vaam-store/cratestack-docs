# ADR 0001: Core Architecture for CoolStack v0

## Status

Proposed

## Date

2026-04-26

## Context

CoolStack is intended to be a Rust-native, schema-first backend framework layer for building typed database-backed HTTP REST APIs, generated clients, declarative authorization policies, and custom business procedures.

The primary developer experience should be:

```rust
coolstack::include_schema!("schema.cool");
```

Developers should define their data model, authorization rules, field exposure rules, custom fields, and procedures in `.cool` schema files. CoolStack should generate a typed ORM client, canonical REST CRUD routes, procedure interfaces, request/response types, generated client libraries, and policy enforcement code.

The project has several important constraints:

* Rust-first.
* SQLx-backed.
* PostgreSQL-first for v0.
* Axum-first for v0.
* HTTP REST only.
* No RPC transport in v0.
* No separate service-description requirement in v0.
* Authentication is delegated to the host framework or application.
* Authorization remains a core CoolStack responsibility.
* Procedures are essential and must be first-class.
* Procedures must always be schema-declared and generated as Rust traits.
* CRUD exposure must be schema-configurable per model and per operation.
* Field visibility and filterability must be controlled by separate schema directives.
* Generated HTTP routes are canonical APIs and are valid for both public and internal service-to-service use.
* JSON must not be assumed as the wire format.
* JSON and CBOR must both be first-class body codecs.
* COSE must be supportable as an optional envelope layer.
* Rust client generation is a first-class deliverable; Dart client generation follows later.
* Resolver-backed custom fields must be supportable from schema directives.
* v0 must avoid an `as_system` or superuser bypass API.

## Decision

CoolStack v0 will use a macro-first, schema-first architecture centered around:

```rust
coolstack::include_schema!("schema.cool");
```

The macro will parse and validate the `.cool` schema at compile time and generate a Rust module named `coolstack_schema` containing:

* model structs
* input structs
* ORM delegates
* field references
* policy enforcement code
* procedure traits
* procedure call helpers
* Axum REST routes
* client-generation metadata
* custom-field resolver traits
* the generated `Coolstack` runtime type

CoolStack v0 will use SQLx as the database execution backend and PostgreSQL as the only supported database.

CoolStack v0 will expose HTTP REST routes only. It will generate CRUD endpoints for models and POST endpoints for procedures. Those generated routes are the canonical service APIs, and other services are expected to call them through generated clients rather than through ad hoc private runtime APIs.

CoolStack will not authenticate users. Instead, applications must provide a `CoolContext` representing the already-authenticated request identity. CoolStack will enforce authorization policies using this context.

CoolStack will support procedures as first-class schema declarations. Applications will implement generated Rust procedure traits. Procedure-level permissions will be checked before the application procedure implementation is called. Handwritten special endpoints are out of scope for the framework philosophy; non-CRUD operations should be declared as procedures.

CoolStack will enforce default-deny authorization semantics. No matching allow rule means the operation is denied.

CoolStack v0 will not provide `as_system` or any equivalent policy-bypass API.

CoolStack will not hard-code JSON into the REST layer. Instead, generated handlers will use a `CoolCodec` trait for body encoding and decoding. JSON and CBOR will both be first-class codec crates, while generated services decide which codecs are enabled.

COSE will be modeled separately from body encoding through a `CoolEnvelope` trait. The envelope layer wraps encoded bytes and can verify, decrypt, sign, encrypt, or MAC request/response bodies.

Generated success responses should default to raw typed bodies. When metadata is needed, schemas should model that explicitly through generated wrapper types instead of forcing a universal `{ data, meta }` success envelope.

## Architecture

## Compile-Time Schema Inclusion

The primary integration point is:

```rust
coolstack::include_schema!("schema.cool");
```

The procedural macro will:

1. Resolve the schema path relative to `CARGO_MANIFEST_DIR`.
2. Read the schema file.
3. Parse the schema.
4. Perform semantic validation.
5. Generate Rust code.
6. Ensure schema changes trigger recompilation.

Generated code will live in a fixed module for v0:

```rust
coolstack_schema
```

## Generated Runtime Surface

The generated module will expose:

```rust
coolstack_schema::Coolstack
coolstack_schema::routes
coolstack_schema::CoolProcedures
coolstack_schema::CustomFieldResolver
coolstack_schema::models
coolstack_schema::user
coolstack_schema::post
```

Example application setup:

```rust
coolstack::include_schema!("schema.cool");

pub struct AppProcedures;

#[async_trait::async_trait]
impl coolstack_schema::CoolProcedures for AppProcedures {
    // generated procedure methods
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let pool = sqlx::PgPool::connect(&std::env::var("DATABASE_URL")?).await?;

    let cool = coolstack_schema::Coolstack::builder(pool).build();

    let app = axum::Router::new()
        .nest(
            "/api",
            coolstack_schema::axum::router(
                cool,
                AppProcedures,
                coolstack_codec_cbor::CborCodec::default(),
                resolve_context,
            ),
        );

    Ok(())
}
```

## ORM Backend

CoolStack v0 will use:

* `sqlx::PgPool`
* `sqlx::Postgres`
* `sqlx::QueryBuilder<Postgres>`
* generated `sqlx::FromRow` structs

The ORM will generate typed delegates per model:

```rust
cool.post().find_many()
cool.post().find_unique(id)
cool.post().create(input)
cool.post().update(id)
cool.post().delete(id)
```

The generated ORM API will be policy-aware. Operations require a `CoolContext` at execution time:

```rust
let posts = cool
    .post()
    .find_many()
    .where_(post::published().eq(true))
    .limit(20)
    .run(&ctx)
    .await?;
```

## REST Transport

CoolStack v0 will generate conventional REST CRUD endpoints:

```text
GET    /posts
GET    /posts/:id
POST   /posts
PATCH  /posts/:id
DELETE /posts/:id
```

For procedures, CoolStack v0 will generate POST endpoints:

```text
POST /$procs/{procedureName}
```

CRUD exposure is schema-configurable per model. Models can expose only the operations explicitly permitted by their schema directives, including public read-only CRUD, protected partial CRUD, or fully hidden CRUD surfaces.

All procedures use POST in v0, including read-like procedures.

Rationale:

* procedure inputs may be complex
* CBOR request bodies are easier than query-string encoding
* COSE envelopes wrap bodies, not query strings
* procedure semantics are not guaranteed to be cache-safe
* v0 should avoid complex HTTP method inference

## Procedures

Procedures are declared in the schema:

```cool
type PublishPostInput {
  postId Int
}

mutation procedure publishPost(args: PublishPostInput): Post
  @allow(auth().role == "admin")
```

CoolStack generates a Rust trait:

```rust
#[async_trait::async_trait]
pub trait CoolProcedures: Send + Sync + 'static {
    async fn publish_post(
        &self,
        db: &Coolstack,
        ctx: &coolstack::CoolContext,
        args: PublishPostInput,
    ) -> Result<Post, coolstack::CoolError>;
}
```

Applications provide an implementation:

```rust
pub struct AppProcedures;

#[async_trait::async_trait]
impl coolstack_schema::CoolProcedures for AppProcedures {
    async fn publish_post(
        &self,
        db: &coolstack_schema::Coolstack,
        ctx: &coolstack::CoolContext,
        args: coolstack_schema::PublishPostInput,
    ) -> Result<coolstack_schema::Post, coolstack::CoolError> {
        db.post()
            .update(args.post_id)
            .set(post::published(), true)
            .run(ctx)
            .await
    }
}
```

Procedure-level authorization is checked before calling the application implementation.

Procedures do not automatically bypass model policies. If a procedure uses the generated ORM, the normal model policies still apply.

## Custom Fields

Schemas may declare resolver-backed custom fields with a field directive:

```cool
type Image {
  storageKey String
  thumbnailUrl String @custom
}
```

For fields marked with `@custom`, CoolStack generates resolver trait methods that applications implement to derive the field value from the source object and request context.

Initial v0 scope:

* `@custom` is supported first on `type` declarations
* generated resolver traits and metadata are part of the compile-time output
* runtime response-field resolution is a staged follow-up slice

This keeps the schema contract stable while the runtime hydration path is completed.

## Client Generation

Generated HTTP routes are intended to be consumed through generated clients.

Planned client roadmap:

* Rust async client generation first
* Dart client generation later, optimized for Riverpod-based frontends

Generated Rust clients should expose both:

* high-level typed methods per CRUD operation and procedure
* a lower-level request-builder escape hatch for advanced use cases

## Authorization Model

CoolStack owns authorization, not authentication.

The host application or framework owns:

* login
* sessions
* cookies
* JWT verification
* OAuth
* user lookup

CoolStack consumes:

```rust
pub struct CoolContext {
    pub auth: Option<CoolAuthIdentity>,
    pub extensions: Extensions,
}
```

Policies may reference:

```cool
auth()
auth().id
auth().role
```

Model permissions use:

```cool
@@allow("read", published || authorId == auth().id)
@@allow("create", auth() != null)
@@allow("update", authorId == auth().id)
@@allow("delete", auth().role == "admin")
```

Procedure permissions use:

```cool
@allow(auth().role == "admin")
```

Default behavior:

```text
No matching allow rule means deny.
```

Multiple allow rules for the same action are OR-combined.

Read, update, and delete policies should be injected into SQL where possible. Create policies may be checked before insertion using the input data and auth context.

## No System Bypass in v0

CoolStack v0 will not expose:

```rust
db.as_system()
```

or any equivalent policy-bypass API.

This reduces the risk that procedures accidentally become privileged execution contexts.

A future ADR may revisit privileged operations after the base policy model is mature.

## Codec Layer

CoolStack generated REST handlers will not assume JSON.

Instead, CoolStack defines:

```rust
pub trait CoolCodec: Clone + Send + Sync + 'static {
    const CONTENT_TYPE: &'static str;

    fn encode<T: serde::Serialize>(&self, value: &T) -> Result<Vec<u8>, CoolError>;

    fn decode<T: serde::de::DeserializeOwned>(&self, bytes: &[u8]) -> Result<T, CoolError>;
}
```

Required v0 codec:

```text
coolstack-codec-cbor
```

Optional codec:

```text
coolstack-codec-json
```

Generated types must derive:

```rust
serde::Serialize
serde::Deserialize
```

This allows codecs to operate generically over generated model, input, output, and error types.

## Envelope Layer

COSE is not a codec. COSE wraps encoded bytes.

CoolStack defines:

```rust
pub trait CoolEnvelope: Clone + Send + Sync + 'static {
    fn request_content_type(&self) -> &'static str;
    fn response_content_type(&self) -> &'static str;

    fn open_request(
        &self,
        bytes: &[u8],
        ctx: &mut CoolContext,
    ) -> Result<Vec<u8>, CoolError>;

    fn seal_response(
        &self,
        bytes: &[u8],
        ctx: &CoolContext,
    ) -> Result<Vec<u8>, CoolError>;
}
```

Core provides:

```text
NoEnvelope
```

Optional COSE crate provides:

```text
CoseSign1Envelope
```

Potential later additions:

```text
CoseEncrypt0Envelope
CoseMac0Envelope
```

Processing order:

```text
Request:
HTTP body -> envelope.open_request -> codec.decode -> auth/policy/ORM/procedure

Response:
Rust value -> codec.encode -> envelope.seal_response -> HTTP body
```

## Crate Layout

CoolStack v0 will use a multi-crate workspace:

```text
coolstack/
  crates/
    coolstack/
      // user-facing runtime crate and re-exports
    coolstack-macros/
      // include_schema! proc macro
    coolstack-parser/
      // .cool parser
    coolstack-core/
      // AST, IR, validation, value model
    coolstack-policy/
      // policy expression handling and SQL compilation
    coolstack-sqlx/
      // SQLx backend
    coolstack-axum/
      // Axum REST integration
    coolstack-codec-cbor/
      // CBOR codec
    coolstack-codec-json/
      // optional JSON codec
    coolstack-cose/
      // optional COSE envelope support
```

## Consequences

## Positive Consequences

* Excellent developer experience through a single `include_schema!` macro.
* Schema remains the source of truth.
* Generated ORM and REST routes stay consistent with the schema.
* Authorization is centralized and declarative.
* Policy literals, predicates, and procedure-policy evaluation now have a canonical shared home in `coolstack-policy`.
* Procedures provide a first-class place for business logic.
* Procedures remain policy-aware by default.
* Authentication stays framework-agnostic.
* The runtime can grow toward richer actor/session/tenant semantics without breaking existing `auth()`-style schemas.
* SQLx provides a mature async database execution layer.
* PostgreSQL-only v0 keeps scope manageable.
* Axum-only v0 keeps HTTP integration manageable.
* CBOR can be used without fighting JSON assumptions.
* COSE can be added without contaminating the ORM or policy layers.
* The codec/envelope split keeps transport concerns clean.
* Default-deny permissions reduce accidental exposure risk.

## Negative Consequences

* Procedural macro-generated code may be harder to debug than generated files.
* Large schema files may increase compile times.
* Compile errors from generated code may be confusing.
* SQLx dynamic queries sacrifice some compile-time SQL checking.
* PostgreSQL-only v0 excludes MySQL and SQLite users.
* Axum-only v0 excludes Actix, Poem, and other framework users.
* POST-only procedures are simple but less semantically pure for read-like operations.
* No `as_system` API may make some administrative workflows harder in v0.
* Compatibility between structured principals and the legacy `auth()` projection adds runtime translation complexity.
* Pluggable codecs add complexity compared to assuming JSON.
* COSE support introduces security-sensitive implementation responsibilities.

## Neutral Consequences

* JSON can still exist, but only as an optional codec.
* Additional documentation exports can be added later, but are not a v0 requirement.
* RPC could theoretically be added later, but is explicitly not part of the current product direction.
* Additional frameworks can be supported later through separate integration crates.

## Alternatives Considered

## Alternative 1: Generate an External Crate Instead of Using a Macro

A CLI could generate a `coolstack-generated` crate that the application imports.

Example:

```toml
coolstack-generated = { path = "./coolstack-generated" }
```

Rejected for v0 because the preferred developer experience is to define `.cool` files and include them directly with:

```rust
coolstack::include_schema!("schema.cool");
```

This avoids an explicit generation step and keeps schema inclusion closer to normal Rust module inclusion.

This alternative may still be useful later as a debugging or build optimization mode.

## Alternative 2: Build a Runtime Schema Interpreter

CoolStack could parse `.cool` at runtime and dynamically serve APIs.

Rejected because:

* weaker type safety
* worse Rust developer experience
* less IDE support
* more runtime failure modes
* harder to expose typed ORM APIs

## Alternative 3: Use Diesel Instead of SQLx

Diesel offers strong compile-time query guarantees.

Rejected for v0 because:

* CoolStack needs dynamic query generation for filters and policy injection
* SQLx has straightforward async support
* SQLx integrates naturally with Axum/Tokio services
* SQLx `QueryBuilder` is well suited to generated dynamic SQL

## Alternative 4: Assume JSON and Add CBOR Later

CoolStack could start with JSON as the default HTTP format and later add CBOR.

Rejected because JSON is explicitly unacceptable for some target projects. If JSON is baked into handlers early, removing that assumption later would be expensive.

The correct abstraction is a codec trait from v0.

## Alternative 5: Treat COSE as a Codec

CoolStack could expose `application/cose` as just another codec.

Rejected because COSE is an envelope over bytes, while CBOR is a serialization format. Treating COSE as a codec would mix serialization, signing, verification, encryption, and application data decoding into one layer.

The chosen model keeps:

```text
codec = typed values <-> bytes
envelope = bytes <-> protected bytes
```

## Alternative 6: Let Procedures Bypass Policies

Procedures could be privileged by default and bypass model-level authorization.

Rejected for v0 because this creates a high risk of accidental data exposure. Procedures should compose the same policy-protected ORM APIs unless and until an explicit privileged operation model is designed.

## Alternative 7: Add `as_system` in v0

CoolStack could provide:

```rust
db.as_system()
```

Rejected for v0 because the permission model should be proven first. A future ADR may introduce a carefully scoped privileged execution model.

## Alternative 8: Support RPC Transport

Procedures could be exposed through RPC-style endpoints.

Rejected because CoolStack v0 is explicitly REST-only. Procedures are exposed over REST as POST endpoints, not as an RPC protocol.

## Decision Drivers

The decision optimizes for:

1. Rust-native developer experience.
2. Schema-first design.
3. Type safety.
4. REST-only APIs.
5. First-class procedures.
6. Strong authorization defaults.
7. External authentication.
8. CBOR/COSE readiness.
9. Manageable v0 scope.
10. Avoiding JSON lock-in.

## Implementation Notes

1. The macro should generate `include_str!` references or equivalent compile-time dependencies so schema changes trigger recompilation.
2. Generated SQL must use bind parameters, never string interpolation of untrusted values.
3. Policy SQL generation should be snapshot-tested.
4. Procedure permissions should be checked before invoking application code.
5. Errors should be encoded with the configured codec.
6. If an envelope is configured, error responses should also be sealed unless request verification fails before a response context can be established.
7. The CLI should provide `coolstack check` and `coolstack print-ir` to make macro debugging easier.
8. JSON support should live outside core.
9. CBOR should be the first official codec implementation.
10. COSE support should be optional and isolated in `coolstack-cose`.

## Follow-Up ADRs

Potential future ADRs:

1. ADR 0002: `.cool` Schema Grammar and Type System.
2. ADR 0003: Permission Expression Semantics and SQL Compilation.
3. ADR 0004: Procedure Routing and Naming.
4. ADR 0005: CBOR Codec Implementation.
5. ADR 0006: COSE Envelope Modes and Key Management.
6. ADR 0007: Migration Strategy.
7. ADR 0008: Relation Loading Strategy.
8. ADR 0009: Privileged Operations and Possible `as_system` Alternative.
9. ADR 0010: Multi-Framework Support Beyond Axum.

## Final Decision Statement

CoolStack v0 will be a macro-first, schema-first Rust framework layer that generates a SQLx-backed ORM, policy-protected REST CRUD routes, and REST procedure endpoints from `.cool` files. It will delegate authentication to the host application, enforce default-deny permissions, avoid system-level policy bypasses, and abstract HTTP body handling through codec and envelope traits so CBOR and COSE can be first-class without sacrificing general developer experience.
