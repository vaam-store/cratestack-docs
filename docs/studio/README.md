## CoolStack Studio

Short version: this is the folder for the "Prisma Studio, but for CoolStack" idea, now reworked around generated full-stack Yew apps. ✨

Important note:

1. `current-state.md` is the verified source of truth for what exists right now
2. several other docs in this folder still describe the target state and are ahead of the current implementation

The current direction is:

1. one generated Studio app per `.cool` file
2. Yew frontend
3. Rust backend
4. backend serves the built frontend and exposes schema-scoped Studio APIs

That means the generator output is not just "some web UI files".

It is a small deployable service.

## What Belongs Here

1. [Current State](./current-state.md)
2. [Generated App Shape](./generated-app.md)
3. [Metadata Contract](./metadata-contract.md)
4. [Backend API](./relay-api.md)
5. [Studio MVP](./mvp.md)
6. [Implementation Spec](./implementation-spec.md)
7. [Generator Module Structs](./generator-module-structs.md)
8. [CLI Patch Plan](./cli-patch-plan.md)
9. [Template Set](./template-set.md)

## Core Principles

1. generation starts from one `.cool` file
2. the result is production-deployable
3. the browser should not own signing secrets
4. Studio stays HTTP-first, not DB-direct
5. procedures are first-class, not side quests

## Doc Reading Order

Read these in order if you want the latest truth first:

1. `current-state.md`
2. `README.md`
3. target-state docs such as `implementation-spec.md`, `relay-api.md`, `metadata-contract.md`, and `mvp.md`

## Why This Direction Fits Better

CoolStack is service-oriented and policy-aware.

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

So the Yew Studio path should stay clearly separated as a generated tooling surface rather than quietly replacing `frontends/vaam-admin`.

Recommended shape:

1. `tools/studios/<name>`
2. or `generated/studios/<name>`

That keeps the experiment honest and the production path explicit. 🔧
