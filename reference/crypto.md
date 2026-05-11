---
title: Crypto Provider
description: Selecting the rustls crypto backend, including the FIPS-validated `aws-lc-rs` option.
---

# Crypto Provider

Rustls supports multiple cryptographic backends. CrateStack does not pin
one — the workspace exposes a feature flag so banks can ship a binary
linked against the validated provider their compliance regime requires.

## Default backend

Without the `crypto-aws-lc-rs` feature, the workspace builds against
rustls's default backend (currently `ring`). This is fine for:

1. development and CI
2. internal services that don't terminate TLS themselves
3. consumer-facing services in jurisdictions with no FIPS requirement

## FIPS-validated backend

Enable the workspace feature:

```toml
[dependencies]
cratestack = { version = "...", features = ["crypto-aws-lc-rs"] }
```

`aws-lc-rs` is the only rustls backend with current FIPS 140-3 module
validation among the pure-Rust providers.

Operational steps for a real FIPS deployment (out of scope for the
framework itself):

1. Build the workspace with `--features crypto-aws-lc-rs`.
2. Use an `aws-lc-rs` / `rustls` build configured against the vendor's
   FIPS-validated `libcrypto`.
3. Call `cratestack::install_fips_crypto_provider()` from your service's
   `main()` **before any TLS-using code runs**.
4. Pin the binary's `cargo audit` report and the validated module's
   certificate id in your release process.

Step 3 currently surfaces a clear runtime error when the feature is
missing:

```rust
fn main() -> Result<(), Box<dyn std::error::Error>> {
    cratestack::install_fips_crypto_provider()?;
    // ... build pool, router, etc.
    Ok(())
}
```

Without the feature flag the function returns
`CoolError::Internal("cratestack was not compiled with crypto-aws-lc-rs feature; FIPS-validated crypto provider is unavailable")`.

The actual provider install
(`rustls::crypto::aws_lc_rs::default_provider().install_default()`) lives
in the bank's own binary so adding `rustls` as a direct dependency here
doesn't force every downstream crate to inherit the choice.

## What this is not

1. **Not a FIPS certification.** Selecting the feature lets you compile a
   binary that uses the validated module — it doesn't make the binary
   "FIPS-certified." That requires the vendor's validated binary and
   your organisation's accreditation process.
2. **Not a kernel-level toggle.** The feature only affects rustls's
   crypto provider. Other TLS-using crates in the dependency graph
   (PostgreSQL drivers, HTTP clients) need their own selection.
3. **Not a database TLS configuration.** SQLx's PostgreSQL TLS is
   configured separately through the connection string and feature
   flags on `sqlx`.

## Read Next

1. [Banking readiness](../overview/banking-readiness) — the broader context for when FIPS matters in this stack
