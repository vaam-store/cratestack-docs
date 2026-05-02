## Generated App Shape

This is the new center of gravity for `cratestack-studio`.

The generator should not produce only a frontend app.

It should produce a small full-stack application per `.cstack` file:

1. a Yew frontend
2. a Rust backend
3. static asset serving from the backend
4. schema-scoped metadata and proxy endpoints from the backend

That gives us a tool that can start from one schema and still be production-ready. 🚀

## Why Yew + Rust Backend

Yew removes the React and `react-admin` dependency entirely.

That is good here because the goal is not "generic admin framework compatibility" anymore.

The goal is:

1. generated from `.cstack`
2. CrateStack-native
3. procedure-aware
4. policy-aware
5. deployable as a standalone service

## Production Rule

Use `Trunk` for builds, not as the production server.

Production shape:

1. `trunk build --release` builds the Yew assets
2. the generated Rust backend serves those assets
3. the same backend exposes Studio APIs under a configurable mount path

So yes, `Trunk + Yew` is viable here, but the production server should still be Rust.

## Proposed Output Layout

```text
payment-gateway-studio/
  Cargo.toml
  README.md
  Dockerfile
  backend/
    src/
      main.rs
      config.rs
      metadata.rs
      proxy.rs
      static_files.rs
  web/
    Cargo.toml
    Trunk.toml
    index.html
    src/
      main.rs
      app.rs
      pages/
      components/
      api/
      state/
  shared/
    src/
      lib.rs
```

## Responsibilities

### `web/`

Owns:

1. schema explorer UI
2. model browsing UI
3. forms and enum pickers
4. procedure runner UI
5. request inspector UI

### `backend/`

Owns:

1. serving Yew assets
2. metadata endpoints
3. CRUD and procedure proxy endpoints
4. auth and signing
5. configuration and health endpoints

### `shared/`

Optional but useful for:

1. generated metadata DTOs
2. shared request and response types
3. mount-path constants

## Suggested Output Location In This Repo

Because the repo already has React and Next.js surfaces, this generated Yew Studio should live in a dedicated tooling area rather than replacing `frontends/vaam-admin`.

Recommended examples:

1. `tools/studios/payment-gateway-studio`
2. `generated/studios/auth-service-studio`

That keeps the experiment explicit instead of quietly creating a third main frontend stack in `frontends/`.

## What The Generated App Should Feel Like

It should feel like:

1. Prisma Studio
2. plus Postman
3. plus a policy-aware service console

It should not feel like:

1. a database admin app pretending services do not exist
2. a browser UI that accidentally became responsible for signing and transport details

That second one is how everyone loses a weekend. 😄
