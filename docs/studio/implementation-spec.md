## Implementation Spec

This document turns the Studio idea into an implementation target.

Scope of this spec:

1. `coolstack generate-studio` CLI shape
2. generated Rust backend layout
3. generated Yew frontend layout
4. first metadata API types and functions

This is intentionally a V1 spec, not the final word forever.

## 1. CLI Command

### Goal

Generate one runnable Studio app from one `.cool` schema.

The output should be a full-stack app:

1. Yew frontend
2. Rust backend
3. backend-served static assets
4. schema-scoped metadata and proxy API

### Proposed Command

```bash
coolstack generate-studio \
  --schema "../vaam-backends/services/payment-gateway/schema/payment.cool" \
  --out "../tools/studios/payment-gateway-studio" \
  --name payment-gateway-studio \
  --service-url "http://127.0.0.1:8085" \
  --mount-path "/studio"
```

### Proposed Clap Shape

```rust
enum Command {
    Check { ... },
    GenerateDart { ... },
    GenerateStudio {
        #[arg(long)]
        schema: PathBuf,
        #[arg(long)]
        out: PathBuf,
        #[arg(long)]
        name: String,
        #[arg(long)]
        service_url: String,
        #[arg(long, default_value = "/studio")]
        mount_path: String,
        #[arg(long, default_value = "dev")]
        profile: String,
        #[arg(long)]
        template_dir: Option<PathBuf>,
    },
    PrintIr { ... },
}
```

### Validation Rules

1. `schema` must parse and validate successfully
2. `mount_path` must begin with `/`
3. `service_url` must be absolute
4. `name` must be filesystem-safe and cargo-safe
5. `out` may exist, but generation should fail if it would overwrite unrelated files unless an explicit overwrite flag is added later

### Initial Generated Files

```text
<out>/
  Cargo.toml
  README.md
  Dockerfile
  .gitignore
  backend/
    Cargo.toml
    src/main.rs
    src/config.rs
    src/http.rs
    src/metadata.rs
    src/proxy.rs
    src/static_files.rs
  web/
    Cargo.toml
    Trunk.toml
    index.html
    src/main.rs
    src/app.rs
    src/api.rs
    src/routes.rs
    src/pages/schema.rs
    src/pages/model_list.rs
    src/pages/model_detail.rs
    src/pages/procedure_runner.rs
    src/components/layout.rs
    src/components/enum_select.rs
    src/components/json_view.rs
    src/state.rs
  shared/
    Cargo.toml
    src/lib.rs
```

### First Non-Goal

Do not make `generate-studio` generate a whole multi-service admin platform in V1.

One schema in, one Studio app out.

That is more than enough work already. 😄

## 2. Generated Rust Backend Layout

### Goal

The backend must be the production server.

It owns:

1. static asset serving
2. metadata route
3. CRUD proxy routes
4. procedure proxy routes
5. auth and signing
6. health routes

### Crate Shape

`backend/Cargo.toml` should depend on:

1. `axum`
2. `tokio`
3. `serde`
4. `serde_json`
5. `reqwest` or the repo-preferred HTTP client
6. generated `shared` crate

### Backend Modules

#### `main.rs`

Owns:

1. config loading
2. router construction
3. binding and startup logging

#### `config.rs`

```rust
pub struct StudioConfig {
    pub service_url: String,
    pub mount_path: String,
    pub bind_addr: String,
    pub enable_dev_context_override: bool,
}
```

#### `metadata.rs`

Owns:

1. loading generated metadata
2. serving `/studio/api/metadata`

#### `proxy.rs`

Owns:

1. model list/get/create/update/delete proxying
2. procedure invocation proxying
3. request signing hooks
4. codec selection

#### `static_files.rs`

Owns:

1. serving built Trunk assets
2. SPA fallback for frontend routing

#### `http.rs`

Owns:

1. route registration
2. request and response normalization helpers
3. shared error translation

### First Routes

```http
GET  /healthz
GET  /studio
GET  /studio/
GET  /studio/assets/*
GET  /studio/api/metadata
GET  /studio/api/models/:model
GET  /studio/api/models/:model/:id
POST /studio/api/models/:model
PATCH /studio/api/models/:model/:id
DELETE /studio/api/models/:model/:id
POST /studio/api/procedures/:procedure
```

### Asset Serving Strategy

In development:

1. backend can serve from `web/dist/` after `trunk build`
2. hot-reload support can be a later improvement

In production:

1. bake `web/dist/` into the image
2. serve with cache headers for hashed assets
3. fall back to `index.html` for SPA routes

### Docker Shape

One image should contain:

1. built backend binary
2. built Yew assets

That keeps deployment simple and matches the product goal: one generated Studio app, one deployable unit.

## 3. Generated Yew Frontend Layout

### Goal

Ship a small, schema-aware UI that is generated enough to start useful but not so generated that it becomes impossible to customize later.

### `web/src/` Layout

```text
src/
  main.rs
  app.rs
  api.rs
  routes.rs
  state.rs
  pages/
    schema.rs
    model_list.rs
    model_detail.rs
    model_edit.rs
    procedure_runner.rs
  components/
    layout.rs
    topbar.rs
    sidebar.rs
    enum_select.rs
    json_view.rs
    request_panel.rs
    table.rs
```

### Responsibilities

#### `main.rs`

Bootstraps Yew.

#### `app.rs`

Owns:

1. global shell
2. route mounting
3. metadata bootstrapping

#### `api.rs`

Owns:

1. calls to `/studio/api/*`
2. typed request DTOs
3. typed response DTOs

#### `state.rs`

Owns:

1. loaded metadata
2. current auth context mode
3. current request inspector payload

### First Pages

#### `pages/schema.rs`

Show:

1. service name
2. models
3. enums
4. procedures

#### `pages/model_list.rs`

Show:

1. rows
2. paging controls
3. filters
4. sort
5. column visibility

#### `pages/model_detail.rs`

Show:

1. record data
2. relation previews
3. raw JSON
4. request metadata

#### `pages/model_edit.rs`

Show:

1. generated scalar inputs
2. enum select inputs
3. JSON text area for `Json`

#### `pages/procedure_runner.rs`

Show:

1. procedure selector
2. arg form
3. response viewer
4. error viewer

### First Useful Generated Widgets

1. `EnumSelect<T>`
2. `JsonView`
3. `RequestPanel`
4. `GenericDataTable`

### Generation Rule

Prefer generating configuration and metadata-driven wiring over generating giant handwritten-looking page trees.

Good:

1. generated route table
2. generated resource config
3. metadata-driven forms

Bad:

1. generating thousands of lines of brittle page-specific Yew code per schema

## 4. First Metadata API Types And Functions

### Goal

Define the first Rust-native metadata surface that `include_schema!` should generate for Studio.

### Generated Rust Surface

```rust
pub mod coolstack_schema {
    pub mod studio {
        pub fn metadata() -> StudioMetadata;
        pub fn service_name() -> &'static str;
        pub fn default_mount_path() -> &'static str;
    }
}
```

### Core Types

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudioMetadata {
    pub service: String,
    pub schema_path: String,
    pub mount_path: String,
    pub models: Vec<StudioModel>,
    pub enums: Vec<StudioEnum>,
    pub procedures: Vec<StudioProcedure>,
    pub routes: Vec<StudioRoute>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudioModel {
    pub name: String,
    pub primary_key: String,
    pub paged: bool,
    pub allowed_fields: Vec<String>,
    pub allowed_includes: Vec<String>,
    pub fields: Vec<StudioField>,
    pub relations: Vec<StudioRelation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudioField {
    pub name: String,
    pub kind: StudioFieldKind,
    pub type_name: String,
    pub required: bool,
    pub list: bool,
    pub enum_name: Option<String>,
    pub enum_values: Vec<String>,
    pub filterable: bool,
    pub sortable: bool,
    pub create_allowed: bool,
    pub update_allowed: bool,
    pub custom: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StudioFieldKind {
    Scalar,
    Relation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudioRelation {
    pub name: String,
    pub target_model: String,
    pub cardinality: StudioRelationCardinality,
    pub local_field: String,
    pub target_field: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StudioRelationCardinality {
    One,
    Many,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudioEnum {
    pub name: String,
    pub values: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudioProcedure {
    pub name: String,
    pub kind: StudioProcedureKind,
    pub args_type: Option<String>,
    pub return_type: String,
    pub return_kind: StudioReturnKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StudioProcedureKind {
    Query,
    Mutation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StudioReturnKind {
    Scalar,
    Model,
    Type,
    Page,
    List,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudioRoute {
    pub name: String,
    pub method: String,
    pub path: String,
}
```

### Initial Generation Sources

Map from existing generated schema internals:

1. `MODELS`
2. `ENUMS`
3. `PROCEDURES`
4. `ModelDescriptor`
5. `ROUTE_TRANSPORTS`
6. parsed schema AST for field, enum, relation, and procedure shapes

### V1 API Behavior

1. metadata is generated at compile time
2. metadata is returned as a plain serializable struct
3. backend serves it unchanged at `/studio/api/metadata`
4. Yew frontend hydrates itself from that payload

### Future Additions

Not required in V1:

1. doc-comment export
2. labels and descriptions
3. display hints
4. policy-explanation metadata
5. custom field UI hints

Those can come later without changing the core idea.

## Suggested Implementation Order

1. add `GenerateStudio` command to `coolstack-cli`
2. add generator crate or module for Studio output
3. add generated Studio metadata Rust types
4. add generated backend shell
5. add generated Yew shell
6. wire metadata endpoint
7. wire model list/get proxy
8. wire procedure proxy
9. add enum-aware forms

That order gets you to a runnable Studio early instead of spending weeks polishing templates before anything can boot.
