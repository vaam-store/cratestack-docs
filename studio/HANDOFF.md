## Studio Handoff

This file is the shortest path for the next developer picking up CrateStack Studio work.

Read this first, then confirm details in `current-state.md`.

## Current Goal

The current generator supports one Studio workspace from one or more `.cstack` files.

The generated app is:

1. a Rust backend
2. a Yew frontend
3. a shared metadata crate
4. an API-first Studio surface, not DB-direct

## Canonical Output

Use this generated workspace as the current reference output:

1. `tools/studios/backends-studio-multi`

It was generated from all current backend schemas in the multi-service workspace.

## Files To Edit

If behavior changes start here:

1. `cratestack/crates/cratestack-cli/src/main.rs`
2. `cratestack/crates/cratestack-studio-generator/src/lib.rs`
3. `cratestack/crates/cratestack-studio-generator/templates/backend/**`
4. `cratestack/crates/cratestack-studio-generator/templates/shared/**`
5. `cratestack/crates/cratestack-studio-generator/templates/web/**`

If docs change start here:

1. `cratestack-docs/docs/studio/current-state.md`
2. `cratestack-docs/docs/studio/README.md`
3. `cratestack/README.md`

## Current Multi-Context Flow

The implemented flow today is:

1. repeat `--schema`
2. repeat `--service-url`
3. optionally repeat `--context`
4. generate workspace metadata with `default_context` and `contexts[]`
5. generate backend proxy routes under `/studio/api/contexts/:context/...`
6. generate frontend routes under `/studio/contexts/:context/...`

## Verified Commands

These checks were already run successfully against the current implementation:

1. `cargo test -p cratestack-studio-generator`
2. `cargo test -p cratestack-cli`
3. fresh multi-context generation into a new output directory
4. `cargo check --workspace` inside the generated workspace
5. `cargo run -p <generated-backend-crate>` inside the generated workspace

If you touch web templates, also run:

1. `cd tools/studios/backends-studio-multi/web`
2. `pnpm install`
3. `trunk build --release`

## Next Work

Recommended order:

1. bring generated templates to parity with the richer live `tools/studios/vendor-service-studio` UX
2. add manifest-driven generation so users do not have to repeat `--schema` and `--service-url`
3. improve ad-hoc procedure query ergonomics so query tabs can use generated structured forms instead of raw JSON only

## Known Limits

Still true today:

1. no manifest-driven Studio generation yet
2. no DB-direct mode
3. no model create/update/delete UI
4. no command palette in generated templates yet
5. no generated query persistence yet

## Reading Order

When in doubt read in this order:

1. `cratestack-docs/docs/studio/HANDOFF.md`
2. `cratestack-docs/docs/studio/current-state.md`
3. `cratestack-docs/docs/studio/README.md`

Treat `current-state.md` as executable truth over older target-state docs in the same folder.
