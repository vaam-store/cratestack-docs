## Generator Module Structs

This document pins down the first Rust struct set for `generate-studio`.

Recommendation:

1. keep `cratestack-cli` thin
2. put Studio generation in a dedicated crate
3. model it after the existing `cratestack-client-dart` generator shape

## Recommended Crate Split

Preferred:

1. `cratestack/crates/cratestack-studio-generator`

Strongly recommended companion crate:

2. `cratestack/crates/cratestack-studio-core`

Why:

1. generator crate owns templates, context-building, and emitted files
2. core crate owns reusable metadata DTOs that the generated backend and frontend can share

If V1 needs to stay smaller, start with `cratestack-studio-generator` first and move the reusable metadata types later.

## Public Generator API

```rust
use std::path::PathBuf;

use cratestack_core::Schema;

pub fn generate_package(
    schema: &Schema,
    config: &StudioGeneratorConfig,
) -> Result<GeneratedStudioPackage, StudioGeneratorError>;
```

## Public Config

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StudioGeneratorConfig {
    pub name: String,
    pub service_name: String,
    pub schema_path: PathBuf,
    pub service_url: String,
    pub mount_path: String,
    pub profile: StudioProfile,
    pub template_dir: Option<PathBuf>,
}
```

## Resolved Config

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
struct ResolvedStudioGeneratorConfig {
    pub name: String,
    pub service_name: String,
    pub schema_path_display: String,
    pub service_url: String,
    pub mount_path: String,
    pub api_mount_path: String,
    pub assets_mount_path: String,
    pub profile: StudioProfile,
    pub package_names: StudioPackageNames,
}
```

## Naming Bundle

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StudioPackageNames {
    pub workspace_name: String,
    pub backend_package: String,
    pub web_package: String,
    pub shared_package: String,
    pub backend_binary: String,
}
```

## Generator Mode

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StudioProfile {
    Dev,
    Prod,
}
```

## Public Generator Error

```rust
#[derive(Debug, thiserror::Error)]
pub enum StudioGeneratorError {
    #[error("studio name '{0}' is not cargo-safe or filesystem-safe")]
    InvalidName(String),

    #[error("mount path '{0}' must begin with '/'")]
    InvalidMountPath(String),

    #[error("service url '{0}' must be absolute")]
    InvalidServiceUrl(String),

    #[error("failed to read template '{template_name}' from {path}: {source}")]
    TemplateRead {
        path: String,
        template_name: &'static str,
        #[source]
        source: std::io::Error,
    },

    #[error("failed to register template '{0}': {1}")]
    TemplateRegistration(&'static str, #[source] minijinja::Error),

    #[error("failed to render template '{0}': {1}")]
    TemplateRender(&'static str, #[source] minijinja::Error),
}
```

## Generated Package And File Types

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GeneratedStudioFile {
    pub file_name: String,
    pub contents: String,
    pub target: StudioPackageTarget,
    pub kind: GeneratedStudioFileKind,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GeneratedStudioPackage {
    pub workspace_name: String,
    pub package_names: StudioPackageNames,
    pub files: Vec<GeneratedStudioFile>,
}
```

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StudioPackageTarget {
    Root,
    Backend,
    Web,
    Shared,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GeneratedStudioFileKind {
    Manifest,
    RustSource,
    Html,
    Config,
    Docs,
    Docker,
    Ignore,
}
```

## Template Spec

```rust
#[derive(Debug, Clone, Copy)]
struct TemplateSpec {
    template_name: &'static str,
    output_path: &'static str,
    target: StudioPackageTarget,
    kind: GeneratedStudioFileKind,
    default_source: &'static str,
}
```

## Top-Level Template Context

```rust
#[derive(Debug, Clone, serde::Serialize)]
struct TemplateContext {
    workspace: WorkspaceContext,
    backend: BackendContext,
    web: WebContext,
    shared: SharedContext,
    metadata: StudioMetadataTemplate,
    shell_routes: Vec<StudioShellRouteTemplate>,
    proxy_routes: Vec<StudioProxyRouteTemplate>,
}
```

## Context Groups

```rust
#[derive(Debug, Clone, serde::Serialize)]
struct WorkspaceContext {
    workspace_name: String,
    service_name: String,
    schema_path: String,
    service_url: String,
    mount_path: String,
    api_mount_path: String,
    assets_mount_path: String,
    profile: &'static str,
}

#[derive(Debug, Clone, serde::Serialize)]
struct BackendContext {
    package_name: String,
    binary_name: String,
    bind_addr_default: String,
    enable_dev_context_override_default: bool,
    metadata_route: String,
    healthz_route: &'static str,
}

#[derive(Debug, Clone, serde::Serialize)]
struct WebContext {
    package_name: String,
    app_title: String,
    mount_path: String,
    api_base_path: String,
    metadata_path: String,
    trunk_public_url: String,
}

#[derive(Debug, Clone, serde::Serialize)]
struct SharedContext {
    package_name: String,
    lib_crate_name: String,
}
```

## Metadata Template Views

```rust
#[derive(Debug, Clone, serde::Serialize)]
struct StudioMetadataTemplate {
    service: String,
    schema_path: String,
    mount_path: String,
    models: Vec<StudioModelTemplate>,
    enums: Vec<StudioEnumTemplate>,
    procedures: Vec<StudioProcedureTemplate>,
    routes: Vec<StudioRouteTemplate>,
}

#[derive(Debug, Clone, serde::Serialize)]
struct StudioModelTemplate {
    name: String,
    primary_key: String,
    paged: bool,
    allowed_fields: Vec<String>,
    allowed_includes: Vec<String>,
    fields: Vec<StudioFieldTemplate>,
    relations: Vec<StudioRelationTemplate>,
}

#[derive(Debug, Clone, serde::Serialize)]
struct StudioFieldTemplate {
    name: String,
    kind: StudioFieldKind,
    type_name: String,
    required: bool,
    list: bool,
    enum_name: Option<String>,
    enum_values: Vec<String>,
    filterable: bool,
    sortable: bool,
    create_allowed: bool,
    update_allowed: bool,
    custom: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
struct StudioRelationTemplate {
    name: String,
    target_model: String,
    cardinality: StudioRelationCardinality,
    local_field: String,
    target_field: String,
    include_allowed: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
struct StudioEnumTemplate {
    name: String,
    values: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
struct StudioProcedureTemplate {
    name: String,
    kind: StudioProcedureKind,
    args_type: Option<String>,
    return_type: String,
    return_kind: StudioReturnKind,
}

#[derive(Debug, Clone, serde::Serialize)]
struct StudioRouteTemplate {
    name: String,
    method: String,
    path: String,
}
```

## Template Helper Enums

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
enum StudioPageKind {
    Schema,
    ModelList,
    ModelDetail,
    ModelEdit,
    ProcedureRunner,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
enum StudioProxyRouteKind {
    Metadata,
    ModelList,
    ModelGet,
    ModelCreate,
    ModelUpdate,
    ModelDelete,
    ProcedureInvoke,
    StaticAssets,
    SpaIndex,
}
```

## Runtime Metadata Types

These belong in `cratestack-studio-core` if that crate is created.

```rust
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct StudioMetadata {
    pub service: String,
    pub schema_path: String,
    pub mount_path: String,
    pub models: Vec<StudioModel>,
    pub enums: Vec<StudioEnum>,
    pub procedures: Vec<StudioProcedure>,
    pub routes: Vec<StudioRoute>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct StudioModel {
    pub name: String,
    pub primary_key: String,
    pub paged: bool,
    pub allowed_fields: Vec<String>,
    pub allowed_includes: Vec<String>,
    pub fields: Vec<StudioField>,
    pub relations: Vec<StudioRelation>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StudioFieldKind {
    Scalar,
    Relation,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct StudioRelation {
    pub name: String,
    pub target_model: String,
    pub cardinality: StudioRelationCardinality,
    pub local_field: String,
    pub target_field: String,
    pub include_allowed: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StudioRelationCardinality {
    One,
    Many,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct StudioEnum {
    pub name: String,
    pub values: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct StudioProcedure {
    pub name: String,
    pub kind: StudioProcedureKind,
    pub args_type: Option<String>,
    pub return_type: String,
    pub return_kind: StudioReturnKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StudioProcedureKind {
    Query,
    Mutation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StudioReturnKind {
    Scalar,
    Model,
    Type,
    Page,
    List,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct StudioRoute {
    pub name: String,
    pub method: String,
    pub path: String,
}
```

## Generated Backend Config Type

```rust
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct StudioConfig {
    pub service_url: String,
    pub mount_path: String,
    pub bind_addr: String,
    pub enable_dev_context_override: bool,
}
```

## Open Decisions

1. Whether `service_name` should be explicit in CLI input or derived from `name`
2. Whether Studio metadata types live immediately in `cratestack-studio-core` or temporarily in the generator crate
3. Whether V1 file output should carry target and kind metadata, or only relative path plus contents

## Recommendation

Start with the smallest pattern that matches `cratestack-client-dart`:

1. one public config struct
2. one public generated package struct
3. one public error enum
4. one `generate_package(...)`
5. a private `TemplateContext` plus narrow view structs

That keeps the generator familiar instead of inventing a brand-new architecture just to generate a brand-new architecture.
