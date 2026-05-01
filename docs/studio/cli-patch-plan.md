## CLI Patch Plan

This document describes the exact patch plan for adding `coolstack generate-studio`.

Design goal:

1. keep `coolstack-cli` thin
2. match the current `generate-dart` command flow
3. delegate real generation to a dedicated generator crate

## Command Shape

```bash
coolstack generate-studio \
  --schema <SCHEMA> \
  --out <OUT> \
  --name <NAME> \
  --service-url <SERVICE_URL> \
  [--mount-path <MOUNT_PATH>] \
  [--profile <PROFILE>] \
  [--template-dir <TEMPLATE_DIR>]
```

## Proposed Clap Variant

```rust
GenerateStudio {
    #[arg(long)]
    schema: PathBuf,
    #[arg(long)]
    out: PathBuf,
    #[arg(long)]
    name: String,
    #[arg(long)]
    service_url: String,
    #[arg(long, default_value = "/studio")]
    mount_path: String,
    #[arg(long, default_value = "dev")]
    profile: String,
    #[arg(long)]
    template_dir: Option<PathBuf>,
}
```

## Files To Touch

Existing:

1. `coolstack/Cargo.toml`
2. `coolstack/crates/coolstack-cli/Cargo.toml`
3. `coolstack/crates/coolstack-cli/src/main.rs`

New:

4. `coolstack/crates/coolstack-studio-generator/Cargo.toml`
5. `coolstack/crates/coolstack-studio-generator/src/lib.rs`
6. `coolstack/crates/coolstack-studio-generator/templates/**`
7. `coolstack/crates/coolstack-studio-generator/tests/generator.rs`

## `main.rs` Patch Plan

### Step 1

Extend `enum Command` with `GenerateStudio { ... }`.

### Step 2

Extract shared schema parsing into a helper:

```rust
fn parse_schema_or_render(schema: &Path) -> Result<coolstack_core::Schema>
```

Use it for:

1. `GenerateDart`
2. `GenerateStudio`
3. `PrintIr`

Keep `Check` separate because of `--format json` behavior.

### Step 3

Add validation helpers:

```rust
fn validate_generate_studio_args(...) -> Result<ValidatedGenerateStudioArgs>
fn validate_mount_path(mount_path: &str) -> Result<()>
fn validate_service_url(service_url: &str) -> Result<url::Url>
fn validate_studio_name(name: &str) -> Result<()>
fn validate_output_dir(out: &Path, generated_files: &[GeneratedStudioFile]) -> Result<()>
```

Validation rules:

1. `schema` must parse successfully
2. `mount_path` must start with `/`
3. `service_url` must be absolute
4. `name` must be cargo-safe and filesystem-safe
5. existing output directory must not contain unrelated files unless an explicit overwrite option is added later

### Step 4

Add:

```rust
fn run_generate_studio(...) -> Result<()>
```

Flow:

1. parse schema
2. validate args
3. call `coolstack_studio_generator::generate_package(...)`
4. preflight output directory safety
5. write generated files
6. print success message

### Step 5

Extract file writing into a helper.

Suggested shape:

```rust
fn write_generated_files(out: &Path, files: &[GeneratedFileLike]) -> Result<()>
```

Behavior:

1. create `out` if needed
2. create parents for nested files
3. write all emitted files
4. only begin writing after preflight validation passes

## Expected `main()` Match Arm

```rust
Command::GenerateStudio {
    schema,
    out,
    name,
    service_url,
    mount_path,
    profile,
    template_dir,
} => {
    run_generate_studio(
        schema,
        out,
        name,
        service_url,
        mount_path,
        profile,
        template_dir,
    )?;
}
```

## Generator Delegation

CLI should delegate to a generator crate, just like `GenerateDart` does today.

Suggested public generator API:

```rust
let package = coolstack_studio_generator::generate_package(
    &parsed,
    &coolstack_studio_generator::StudioGeneratorConfig {
        name,
        service_name,
        schema_path: schema.clone(),
        service_url,
        mount_path,
        profile,
        template_dir,
    },
)?;
```

## Proposed Success Output

```rust
println!("generated Studio app: {}", out.display());
```

## Proposed Unit Tests In `coolstack-cli`

1. `generate_studio_clap_defaults`
2. `validate_mount_path_rejects_missing_leading_slash`
3. `validate_service_url_rejects_relative_url`
4. `validate_studio_name_rejects_invalid_chars`
5. `validate_output_dir_rejects_unrelated_existing_files`
6. `write_generated_files_creates_nested_directories`

## Proposed Generator Tests

In `coolstack-studio-generator/tests/generator.rs`:

1. `generate_package_emits_expected_root_files`
2. `generate_package_injects_name_service_url_mount_path_profile`
3. `template_override_directory_replaces_default_template`
4. `generator_rejects_invalid_template_override_read`

## Risky Spots

1. Output directory collision handling
2. Name validation rules drifting between cargo-safe and filesystem-safe
3. Keeping V1 scoped to scaffolding rather than overbuilding Studio behavior
4. Re-run behavior when generated directories later contain `target/` or `dist/`

## Smallest Viable Next Step

1. add `GenerateStudio` subcommand
2. add generator crate with template-based scaffold output
3. reuse the same parse -> generate -> write flow as `GenerateDart`

That is enough to land the command without pretending the entire Studio runtime is already finished.
