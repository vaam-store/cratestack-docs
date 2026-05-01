## Current State

This document is the verified current-state snapshot for CoolStack Studio.

It is intentionally different from the target-state design docs in this folder.

If this file conflicts with another Studio doc, prefer this file.

## Verified Scope

Current implementation is a generated full-stack Studio app with:

1. one or more `.cool` schemas as input
2. one generated Rust workspace as output
3. Rust backend
4. Yew frontend
5. shared crate for generated metadata and proxy response types

Current generator entrypoint:

```bash
coolstack generate-studio \
  --schema ../vaam-backends/services/auth-service/schema/auth.cool \
  --service-url http://127.0.0.1:8081 \
  --schema ../vaam-backends/services/vendor-service/schema/vendor.cool \
  --service-url http://127.0.0.1:8082 \
  --out ../tools/studios/vaam-backends-studio \
  --name vaam-backends-studio
```

Current CLI arguments are:

1. repeated `--schema`
2. `--out`
3. `--name`
4. repeated `--service-url`
5. optional repeated `--context`
6. `--mount-path` default `/studio`
7. `--profile` as `dev|prod`
8. `--template-dir`

## Architecture

Current Studio is API-first, not DB-direct.

That means:

1. the browser talks to the generated Rust backend
2. the generated backend serves the frontend assets
3. the generated backend proxies model and procedure requests upstream
4. upstream mapping is currently one schema context to one `service_url`

Direct database access is not implemented.

Multi-schema or multi-`.cool` support is implemented through repeated CLI pairs.

There is currently no generated manifest that maps:

1. `.cool` file to API URL
2. `.cool` file to DB URL
3. display label to schema context

## Generated Backend

Current generated backend routes are:

```http
GET  /healthz
GET  /healthz/ready
GET  /studio
GET  /studio/
GET  /studio/assets/*
GET  /studio/api/metadata
GET  /studio/api/contexts/:context/models/:model
GET  /studio/api/contexts/:context/models/:model/:id
POST /studio/api/contexts/:context/procedures/:procedure
GET  /studio/{*path} -> SPA fallback
```

Current proxy behavior is thin passthrough:

1. forwards `Accept`
2. forwards `Authorization`
3. forwards `x-*` headers
4. normalizes the response into `StudioProxyResponse`

Current backend does **not** implement:

1. create/update/delete model mutation proxy routes
2. auth-context simulation
3. signing or transport-policy enforcement beyond passthrough

## Generated Metadata

Current metadata is generated into `shared/src/metadata.json` and loaded into `StudioMetadata`.

Current shape is:

1. `name`
2. `mount_path`
3. `default_context`
4. `contexts`

Current per-context metadata includes:

1. `key`
2. `display_name`
3. `service`
4. `schema_path`
5. `service_url`
6. `models`
7. `enums`
8. `procedures`

Current model metadata includes:

1. `name`
2. `display_name`
3. `resource_path`
4. `primary_key`
5. `paged`
6. `scalar_fields`
7. `relations`
8. `list_columns`

Current procedure metadata includes:

1. `name`
2. `display_name`
3. `route_path`
4. `kind`
5. `args_type`
6. `payload_mode`
7. `input_fields`
8. `return_type`
9. `return_kind`

Current metadata contract does **not** include richer target-state fields such as:

1. field-level filterability/sortability
2. create/update permissions
3. route inventory objects
4. auth-context metadata
5. transport metadata
6. UI display hints

## Current Frontend UX

Current generated frontend includes:

1. left global rail
2. explorer sidebar
3. shell-level editor tab strip
4. per-page subtabs
5. metadata drawer
6. real schema-context selector in the top bar
7. model view
8. procedure view
9. API explorer view
10. ad-hoc query tabs

Current global rail modes are:

1. Overview
2. Explorer
3. New Query
4. API Explorer

Current explorer behavior:

1. metadata-local text filtering
2. collapsible sections for tables, procedures, and enums

Current query tab behavior:

1. query tabs are routable under `/studio/contexts/:context/queries/:id`
2. tabs can be created and closed
3. tab state is preserved while switching tabs during the current page session

Current query tab modes are:

1. model query mode using backend model list proxy plus optional `q`
2. procedure call mode using explicit JSON body
3. raw response view

Current procedure page behavior:

1. generated form fields from procedure metadata
2. enum/select, boolean, number, JSON, and textarea-aware controls
3. request execution through backend procedure proxy
4. response preview and raw response views

## Current Persistence

Current generated templates do not yet persist workspace state.

The older live `vendor-service-studio` app still contains IndexedDB-backed query-tab persistence, which is one of the remaining generator/template parity gaps.

## Current Limitations

Current verified limitations are:

1. no multi-schema manifest support
2. no DB-direct mode
3. no model create/update/delete UI
4. no record detail page wired to `GET /studio/api/contexts/:context/models/:model/:id`
5. no enum detail route/page
6. no command palette or keyboard-driven search overlay in the generated templates yet
7. generator/template parity is incomplete relative to the latest live `vendor-service-studio`

One known implementation gap in the older live app is that closed query tabs may leave orphaned query-state entries in persisted storage.

## Docs Status

This folder currently contains both:

1. target-state design/spec docs
2. current-state runtime truth

Use them like this:

1. `current-state.md` is verified truth
2. `README.md` is the high-level index
3. `implementation-spec.md`, `metadata-contract.md`, `relay-api.md`, `mvp.md`, and `template-set.md` are still useful as target-state references, but parts of them are ahead of the code

## Next Work

The most important unfinished Studio work is:

1. full generator parity with the latest live app UX
2. manifest-driven multi-context Studio generation
3. better procedure-query ergonomics without raw JSON dependence for ad-hoc query tabs
