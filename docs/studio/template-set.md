## Template Set

This document defines the first template inventory for `generate-studio`.

The output target is one per-schema full-stack Studio app:

1. Yew frontend
2. Rust backend
3. shared crate for DTOs and constants
4. root workspace files

## Generator Pattern

Match the existing `coolstack-client-dart` generator style:

1. fixed `TEMPLATE_SPECS`
2. built-in defaults
3. optional `--template-dir` override
4. one normalized Rust template context
5. thin templates, not clever templates

## Proposed Template Directory Layout

```text
coolstack/crates/coolstack-studio-generator/templates/
  root/
    Cargo.toml.j2
    README.md.j2
    Dockerfile.j2
    .gitignore.j2

  shared/
    Cargo.toml.j2
    src/
      lib.rs.j2

  backend/
    Cargo.toml.j2
    src/
      main.rs.j2
      config.rs.j2
      http.rs.j2
      metadata.rs.j2
      proxy.rs.j2
      static_files.rs.j2

  web/
    Cargo.toml.j2
    Trunk.toml.j2
    index.html.j2
    src/
      main.rs.j2
      app.rs.j2
      api.rs.j2
      routes.rs.j2
      state.rs.j2
      pages/
        schema.rs.j2
        model_list.rs.j2
        model_detail.rs.j2
        model_edit.rs.j2
        procedure_runner.rs.j2
      components/
        layout.rs.j2
        topbar.rs.j2
        sidebar.rs.j2
        enum_select.rs.j2
        json_view.rs.j2
        request_panel.rs.j2
        table.rs.j2
```

## Root Templates

### `root/Cargo.toml.j2`

Purpose:

1. workspace manifest
2. members for `backend`, `web`, `shared`
3. shared package metadata

Needs:

1. `workspace.workspace_name`
2. `workspace.members`
3. `workspace.rust_edition`

### `root/README.md.j2`

Purpose:

1. generated app overview
2. schema path
3. service URL
4. local build and run commands
5. production summary

Needs:

1. `app.name`
2. `app.service_name`
3. `app.schema_path`
4. `app.service_url`
5. `app.mount_path`

### `root/Dockerfile.j2`

Purpose:

1. multi-stage build
2. build Yew assets with Trunk
3. build Rust backend
4. ship one image containing binary plus assets

Needs:

1. `workspace.backend_crate_name`
2. `workspace.web_crate_name`
3. `workspace.backend_binary_name`

### `root/.gitignore.j2`

Purpose:

1. ignore `/target`
2. ignore `/web/dist`
3. ignore Trunk cache

Needs:

1. none

## Shared Templates

### `shared/Cargo.toml.j2`

Purpose:

1. shared crate manifest

Needs:

1. `workspace.shared_crate_name`
2. `workspace.rust_edition`

### `shared/src/lib.rs.j2`

Purpose:

1. metadata DTOs
2. shared request/response types
3. mount and API path constants

Needs:

1. `app.mount_path`
2. `derived.api_base_path`
3. `schema.models`
4. `schema.enums`
5. `schema.procedures`

## Backend Templates

### `backend/Cargo.toml.j2`

Purpose:

1. backend manifest
2. path dep on `shared`

Needs:

1. `workspace.backend_crate_name`
2. `workspace.shared_crate_name`
3. `workspace.rust_edition`

### `backend/src/main.rs.j2`

Purpose:

1. config load
2. router build
3. startup

Needs:

1. `app.name`
2. `app.mount_path`
3. `workspace.backend_binary_name`

### `backend/src/config.rs.j2`

Purpose:

1. `StudioConfig`
2. env loading
3. defaults

Needs:

1. `app.service_url`
2. `app.mount_path`
3. `backend.bind_addr_default`
4. `backend.enable_dev_context_override_default`

### `backend/src/http.rs.j2`

Purpose:

1. route registration
2. health route
3. metadata route
4. proxy routes
5. SPA fallback

Needs:

1. `app.mount_path`
2. `derived.api_base_path`

### `backend/src/metadata.rs.j2`

Purpose:

1. serve `/studio/api/metadata`
2. expose generated metadata payload

Needs:

1. `app.mount_path`
2. generated metadata contract fields

### `backend/src/proxy.rs.j2`

Purpose:

1. model CRUD proxying
2. procedure proxying
3. signing and transport hooks
4. request inspector payload capture

Needs:

1. `app.service_url`
2. `schema.models[].name`
3. `schema.models[].primary_key`
4. `schema.procedures[].name`
5. `schema.routes`
6. `backend.auth_modes`

### `backend/src/static_files.rs.j2`

Purpose:

1. serve built Trunk assets
2. serve SPA fallback

Needs:

1. `app.mount_path`
2. `backend.web_dist_relative_path`

## Web Templates

### `web/Cargo.toml.j2`

Purpose:

1. Yew app manifest
2. dependencies like `yew`, `yew-router`, `gloo-net`, `serde`
3. path dep on `shared`

Needs:

1. `workspace.web_crate_name`
2. `workspace.shared_crate_name`
3. `workspace.rust_edition`

### `web/Trunk.toml.j2`

Purpose:

1. Trunk build config
2. public URL aligned with mount path

Needs:

1. `app.mount_path`

### `web/index.html.j2`

Purpose:

1. Yew entry HTML
2. app title

Needs:

1. `app.name`

### `web/src/main.rs.j2`

Purpose:

1. bootstrap Yew app

Needs:

1. none

### `web/src/app.rs.j2`

Purpose:

1. global shell
2. metadata bootstrap
3. route mounting

Needs:

1. `app.name`
2. `schema.models`
3. `schema.procedures`
4. `derived.api_base_path`

### `web/src/api.rs.j2`

Purpose:

1. calls to `/studio/api/*`
2. typed request and response DTOs

Needs:

1. `derived.api_base_path`
2. `schema.models`
3. `schema.procedures`

### `web/src/routes.rs.j2`

Purpose:

1. route enum
2. route parsing
3. route generation

Needs:

1. `app.mount_path`

### `web/src/state.rs.j2`

Purpose:

1. metadata state
2. request inspector state
3. auth context mode state

Needs:

1. `schema.models`
2. `schema.procedures`
3. `backend.auth_modes`

### `web/src/pages/schema.rs.j2`

Purpose:

1. service summary
2. models, enums, procedures explorer

Needs:

1. `schema.models`
2. `schema.enums`
3. `schema.procedures`
4. `app.service_name`
5. `app.schema_path`
6. `app.service_url`

### `web/src/pages/model_list.rs.j2`

Purpose:

1. generic list screen
2. columns, paging, sort, filters

Needs:

1. `schema.models`
2. `schema.models[].allowed_fields`
3. `schema.models[].paged`

### `web/src/pages/model_detail.rs.j2`

Purpose:

1. detail view
2. relation previews
3. raw JSON
4. request panel

Needs:

1. `schema.models`
2. `schema.models[].fields`
3. `schema.models[].relations`

### `web/src/pages/model_edit.rs.j2`

Purpose:

1. create/edit form
2. enum select inputs
3. JSON field editing

Needs:

1. `schema.models`
2. `schema.enums`
3. `schema.models[].fields`
4. `schema.models[].primary_key`

### `web/src/pages/procedure_runner.rs.j2`

Purpose:

1. procedure selector
2. argument form
3. response and error views

Needs:

1. `schema.procedures`
2. `schema.enums`
3. procedure arg field metadata

### `web/src/components/layout.rs.j2`

Purpose:

1. outer layout shell

Needs:

1. `app.name`

### `web/src/components/topbar.rs.j2`

Purpose:

1. service header
2. auth context switcher
3. request summary slot

Needs:

1. `app.service_name`
2. `backend.auth_modes`

### `web/src/components/sidebar.rs.j2`

Purpose:

1. model and procedure navigation

Needs:

1. `schema.models`
2. `schema.procedures`

### `web/src/components/enum_select.rs.j2`

Purpose:

1. reusable enum picker widget

Needs:

1. `schema.enums`

### `web/src/components/json_view.rs.j2`

Purpose:

1. formatted JSON view

Needs:

1. none

### `web/src/components/request_panel.rs.j2`

Purpose:

1. request inspector display

Needs:

1. shared request-inspector DTO shape

### `web/src/components/table.rs.j2`

Purpose:

1. generic metadata-driven data table shell

Needs:

1. `schema.models[].allowed_fields`

## Context Groups

### App Identity

1. `app.name`
2. `app.service_name`
3. `app.schema_path`
4. `app.service_url`
5. `app.mount_path`
6. `app.profile`

### Workspace And Naming

1. `workspace.workspace_name`
2. `workspace.backend_crate_name`
3. `workspace.backend_binary_name`
4. `workspace.web_crate_name`
5. `workspace.shared_crate_name`
6. `workspace.rust_edition`
7. `workspace.members[]`

### Derived Paths

1. `derived.api_base_path`
2. `derived.assets_base_path`
3. `derived.health_path`
4. `derived.metadata_path`
5. `derived.web_dist_relative_path`

### Schema Metadata

1. `schema.models[]`
2. `schema.enums[]`
3. `schema.procedures[]`
4. `schema.routes[]`

### Backend Behavior

1. `backend.bind_addr_default`
2. `backend.enable_dev_context_override_default`
3. `backend.auth_modes[]`

### Helpful Flags

1. `flags.has_models`
2. `flags.has_enums`
3. `flags.has_procedures`
4. `flags.has_relations`
5. `flags.has_paged_models`
6. `flags.has_json_fields`
7. `flags.has_enum_fields`

## Minimum Viable Template Subset

Start with:

### Root

1. `Cargo.toml.j2`
2. `README.md.j2`
3. `Dockerfile.j2`
4. `.gitignore.j2`

### Shared

5. `shared/Cargo.toml.j2`
6. `shared/src/lib.rs.j2`

### Backend

7. `backend/Cargo.toml.j2`
8. `backend/src/main.rs.j2`
9. `backend/src/config.rs.j2`
10. `backend/src/http.rs.j2`
11. `backend/src/metadata.rs.j2`
12. `backend/src/proxy.rs.j2`
13. `backend/src/static_files.rs.j2`

### Web

14. `web/Cargo.toml.j2`
15. `web/Trunk.toml.j2`
16. `web/index.html.j2`
17. `web/src/main.rs.j2`
18. `web/src/app.rs.j2`
19. `web/src/api.rs.j2`
20. `web/src/routes.rs.j2`
21. `web/src/state.rs.j2`
22. `web/src/pages/schema.rs.j2`
23. `web/src/pages/model_list.rs.j2`
24. `web/src/pages/model_detail.rs.j2`
25. `web/src/pages/procedure_runner.rs.j2`
26. `web/src/components/layout.rs.j2`
27. `web/src/components/json_view.rs.j2`
28. `web/src/components/request_panel.rs.j2`
29. `web/src/components/table.rs.j2`

Defer from V1:

1. `model_edit.rs.j2`
2. `enum_select.rs.j2`
3. `topbar.rs.j2`
4. `sidebar.rs.j2`

## Emission Order

Suggested first pass order:

1. `root/.gitignore.j2`
2. `root/Cargo.toml.j2`
3. `shared/Cargo.toml.j2`
4. `shared/src/lib.rs.j2`
5. `backend/Cargo.toml.j2`
6. `backend/src/config.rs.j2`
7. `backend/src/metadata.rs.j2`
8. `backend/src/proxy.rs.j2`
9. `backend/src/static_files.rs.j2`
10. `backend/src/http.rs.j2`
11. `backend/src/main.rs.j2`
12. `web/Cargo.toml.j2`
13. `web/Trunk.toml.j2`
14. `web/index.html.j2`
15. `web/src/api.rs.j2`
16. `web/src/routes.rs.j2`
17. `web/src/state.rs.j2`
18. `web/src/components/layout.rs.j2`
19. `web/src/components/json_view.rs.j2`
20. `web/src/components/request_panel.rs.j2`
21. `web/src/components/table.rs.j2`
22. `web/src/pages/schema.rs.j2`
23. `web/src/pages/model_list.rs.j2`
24. `web/src/pages/model_detail.rs.j2`
25. `web/src/pages/procedure_runner.rs.j2`
26. `web/src/app.rs.j2`
27. `web/src/main.rs.j2`
28. `root/README.md.j2`
29. `root/Dockerfile.j2`

## Keep Output Thin

Prefer generating:

1. route config
2. resource config
3. metadata DTOs
4. generic runtime components

Avoid generating:

1. giant per-model page trees
2. per-model backend handlers
3. CI or deployment systems in V1
4. elaborate widget logic before metadata proves it is needed

Thin generated output ages better.

Over-generated output becomes archaeology surprisingly fast. 🏺
