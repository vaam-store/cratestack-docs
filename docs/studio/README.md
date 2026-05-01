## CoolStack Studio

Short version: this is the folder for the "Prisma Studio, but for CoolStack" idea, now reworked around generated full-stack Yew apps. ✨

The current direction is:

1. one generated Studio app per `.cool` file
2. Yew frontend
3. Rust backend
4. backend serves the built frontend and exposes schema-scoped Studio APIs

That means the generator output is not just "some web UI files".

It is a small deployable service.

## What Belongs Here

1. [Generated App Shape](./generated-app.md)
2. [Metadata Contract](./metadata-contract.md)
3. [Backend API](./relay-api.md)
4. [Studio MVP](./mvp.md)

## Core Principles

1. generation starts from one `.cool` file
2. the result is production-deployable
3. the browser should not own signing secrets
4. Studio stays HTTP-first, not DB-direct
5. procedures are first-class, not side quests

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
