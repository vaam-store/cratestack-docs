# CoolStack Editor Tooling

This document records the current state of CoolStack editor support, how to use it locally, and the most useful follow-up work.

## Scope

CoolStack has two editor surfaces:

* Rust files that consume `coolstack::include_schema!(...)`
* `.cool` schema files authored directly

Those surfaces have different constraints.

Rust support depends on a real Cargo workspace because `include_schema!` is a proc macro that expands relative to a real schema path.

`.cool` support is intentionally split out into a standalone language server so basic schema authoring does not require a full host project checkout.

## Current State

Implemented in this repo today:

* `crates/coolstack-lsp` provides a standalone language server for `.cool` files
* `packages/coolstack-vscode` provides the VS Code extension wrapper that launches `coolstack-lsp`
* `coolstack-cli check --format json` provides machine-readable diagnostics for CI or editor fallback integrations
* parser and semantic structures now preserve schema docs and source spans needed for editor features and generated Rust docs
* `include_schema!` now emits Rust `#[doc = "..."]` attributes from schema-authored comments

Implemented `.cool` editor features:

* diagnostics
* hover
* completion
* go-to-definition
* document symbols
* basic syntax highlighting through the bundled TextMate grammar
* relation-aware definition lookup inside `@relation(fields:[...],references:[...])`
* narrower relation diagnostics that point at the bad relation token instead of only the whole declaration line

Implemented Rust-side editor improvements:

* schema `///` docs now flow into generated Rust docs and rust-analyzer hovers when proc-macro expansion is enabled
* procedure `/// @param name ...` docs now flow into generated procedure argument types

Current limitations:

* the parser still validates an initial schema subset rather than the full target grammar described across the broader docs
* Rust-side support is still project-dependent and requires real Cargo context
* the LSP does not yet implement rename, references, formatting, semantic tokens, or code actions
* the VS Code extension prefers a bundled server binary when one is staged, but it does not yet auto-download release binaries

## Rust Setup In VS Code

For Rust consumers of `include_schema!`, use `rust-analyzer` and point it at the workspace or workspaces that actually build the schema consumer.

Recommended workspace settings for this repo:

```json
{
  "rust-analyzer.linkedProjects": [
    "coolstack/Cargo.toml",
    "vaam-backends/Cargo.toml"
  ],
  "rust-analyzer.procMacro.enable": true,
  "rust-analyzer.cargo.buildScripts.enable": true,
  "rust-analyzer.checkOnSave": true,
  "rust-analyzer.check.allTargets": true
}
```

Why this is required:

* this repo root is not a single Cargo workspace
* generated Rust APIs come from proc-macro expansion
* the generated `coolstack_schema` module only exists when rust-analyzer can build the real consumer crate

## `.cool` Setup In VS Code

The intended path for `.cool` files is the `coolstack-vscode` extension plus `coolstack-lsp`.

Local development flow:

1. From `coolstack/`, build the language server with `cargo build -p coolstack-lsp`.
2. From `coolstack/packages/coolstack-vscode`, run `pnpm install` if needed.
3. Install or run the extension.
4. If the server binary is not on `PATH` and not bundled into the extension package, set `coolstack.lsp.path` to the built binary.

Supported extension settings:

* `coolstack.lsp.path`: path to the `coolstack-lsp` binary
* `coolstack.lsp.args`: extra args passed through to the server

The extension resolves the server in this order:

1. bundled binary under `server/<platform>/coolstack-lsp`
2. configured `coolstack.lsp.path`
3. `coolstack-lsp` on `PATH`

## CLI Fallback And CI

For machine-readable schema validation outside the editor:

```bash
cargo run -p coolstack-cli -- check --schema path/to/schema.cool --format json
```

This is useful for:

* CI validation
* fallback editor integrations outside VS Code
* smoke-testing parser and semantic diagnostics without starting the LSP

## Schema Docs And Generated Rust Docs

Schema-authored comments now serve both schema authors and Rust consumers.

Supported today:

* leading `///` comments on declarations and fields
* `/// @param name ...` docs for procedure arguments
* proc-macro emission of Rust `#[doc = "..."]` attributes for generated models, fields, inputs, and procedure modules

This keeps one documentation source for:

* `.cool` authors reading schemas
* Rust users reading generated API docs and hovers
* future richer hover content in the `.cool` language server

## Packaging And Release Flow

The current extension packaging model is intentionally thin.

`coolstack-vscode` contributes the language registration and launches `coolstack-lsp`; the heavy logic stays in the Rust binary.

Current release flow:

1. Build the release server with `cargo build --release -p coolstack-lsp`.
2. Stage the binary into `packages/coolstack-vscode/server/<platform>/` with `pnpm run stage-server`.
3. Package the extension with `pnpm run package:vsix`.

The VSIX packaging step uses `vsce --no-dependencies` because the extension ships a small JavaScript wrapper plus the staged server binary rather than relying on npm dependency scanning to decide runtime contents.

## Verification In Repo

Covered today:

* parser tests for docs, spans, and related regressions
* LSP tests for hover, definitions, symbols, and relation diagnostics
* extension package tests for server path resolution
* VS Code extension-host smoke tests for activation and bundled server launch
* Rust workspace tests for the underlying crates

This gives reasonable confidence that the current editor stack works end to end, including packaged extension behavior.

## Future Improvements

Highest-value follow-up work:

1. Add code actions for common relation mistakes, especially missing `fields` / `references` targets and simple typo recovery.
2. Add semantic tokens so schema highlighting is less dependent on the TextMate grammar alone.
3. Add rename, find-references, and document-wide symbol search on top of the precise spans now carried in the schema model.
4. Add stronger extension-host end-to-end tests that assert definition, hover, and diagnostics through the actual VS Code APIs.
5. Reduce VSIX size with a `files` allowlist or `.vscodeignore` and add missing package metadata such as repository and license fields.

Likely medium-term work:

1. Extend the parser and semantic model toward the full target grammar described in the broader PRD and ADR docs.
2. Add richer relation-aware validation so relation diagnostics can reason about more mismatches before code generation.
3. Expose more stable editor-oriented library surfaces from parser and semantic crates instead of keeping some logic narrowly embedded in the current LSP layer.
4. Improve multi-platform release packaging so extension artifacts can be produced and verified more systematically across supported targets.
5. Add non-VS-Code editor integration paths using the standalone `coolstack-lsp` binary.

Deferred or optional follow-ups:

1. Formatting support for `.cool` once the schema grammar and style expectations stabilize.
2. Auto-download or release-channel discovery for `coolstack-lsp` binaries instead of requiring either a bundled server or manual path setup.
3. More workspace-aware Rust and schema cross-navigation if future architecture needs symbol links between generated Rust surfaces and original schema declarations.
