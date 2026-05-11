## CrateStack Studio

Short version: this is the folder for the "Prisma Studio, but for CrateStack" idea, now reworked around generated full-stack Yew apps. ✨

Important note:

1. `current-state.md` is the verified source of truth for what exists right now
2. several other docs in this folder still describe the target state and are ahead of the current implementation

The current direction is:

1. one generated Studio app from one or more `.cstack` files
2. Yew frontend
3. Rust backend
4. backend serves the built frontend and exposes context-scoped Studio APIs

That means the generator output is not just "some web UI files".

It is a small deployable service.

## What Belongs Here

1. [Current State](./current-state.md)
2. [Developer Handoff](./HANDOFF.md)
3. [Generated App Shape](./generated-app.md)
4. [Metadata Contract](./metadata-contract.md)
5. [Backend API](./relay-api.md)
6. [Studio MVP](./mvp.md)
7. [Implementation Spec](./implementation-spec.md)
8. [Generator Module Structs](./generator-module-structs.md)
9. [CLI Patch Plan](./cli-patch-plan.md)
10. [Template Set](./template-set.md)

## Core Principles

1. generation starts from one `.cstack` file
2. the result is production-deployable
3. the browser should not own signing secrets
4. Studio stays HTTP-first, not DB-direct
5. procedures are first-class, not side quests

## Doc Reading Order

Read these in order if you want the latest truth first:

1. `current-state.md`
2. `HANDOFF.md`
3. `README.md`
4. target-state docs such as `implementation-spec.md`, `relay-api.md`, `metadata-contract.md`, and `mvp.md`

## Developer Handoff

If you are the next developer picking this up, start here:

1. `current-state.md` for verified behavior and limits
2. `cratestack/crates/cratestack-cli/src/main.rs` for CLI input shape
3. `cratestack/crates/cratestack-studio-generator/src/lib.rs` for generator data flow
4. `cratestack/crates/cratestack-studio-generator/templates/**` for generated backend/frontend behavior
5. `tools/studios/backends-studio-multi/` for the latest canonical generated multi-context output

Verified generator/backend checks already run for the current implementation:

1. `cargo test -p cratestack-studio-generator`
2. `cargo test -p cratestack-cli`
3. generate a fresh multi-context Studio workspace from all backend schemas in the multi-service workspace
4. `cargo check --workspace` inside the generated workspace
5. `cargo run -p <generated-backend-crate>` inside the generated workspace

The next developer should still run the generated frontend build path explicitly when changing web templates:

1. `cd tools/studios/backends-studio-multi/web`
2. `pnpm install`
3. `trunk build --release`

## Why This Direction Fits Better

CrateStack is service-oriented and policy-aware.

So a good Studio should understand:

1. CRUD routes
2. procedures
3. metadata
4. enums
5. policies
6. signed requests

That is why the generated backend is part of the product design, not a convenience wrapper.

## Repo Alignment Note

This repo already has React-based web surfaces.

So the Yew Studio path should stay clearly separated as a generated tooling surface rather than quietly replacing `frontends/admin-frontend`.

Recommended shape:

1. `tools/studios/<name>`
2. or `generated/studios/<name>`

That keeps the experiment honest and the production path explicit. 🔧
