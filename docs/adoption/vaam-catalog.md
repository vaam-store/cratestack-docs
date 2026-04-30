# Getting Started With `catalog-service` And `vaam-mobile`

This guide documents the first end-to-end adoption path for CrateStack inside this repo.

Target outcome:

* start from `vaam-backends` with the catalog domain
* keep one shared `.cool` schema for the catalog client contract
* generate a Dart package under `frontends/vaam-mobile/packages/gen-*`
* import that generated Dart package into `frontends/vaam-mobile/pubspec.yaml`
* keep mobile Rust focused on generic request execution, signing, and upload helpers in `frontends/vaam-mobile/rust/vaam_runtime`

## Current Repo Reality

Verified current state in this repo:

* `vaam-backends/services/catalog-service` now uses a generated CrateStack router for products and procedures, with only health checks left manual.
* The richer catalog relation slice is now live-verified for `ownerSummary`, `assets`, `thumbnailAsset`, `options`, `variants`, and nested `Variant.thumbnailAsset`.
* The catalog contract is currently described in prose at `vaam-backends/docs/service-interface/catalog-service.md`.
* `catalog.cool` now covers `Owner`, `Asset`, `ProductOption`, `Variant`, `Product`, and the publish/upload procedures at `vaam-backends/services/catalog-service/schema/catalog.cool`.
* The CrateStack CLI currently supports `generate-dart`, `check`, `check --format json`, and `print-ir`.
* There is no standalone `generate-rust` CLI command yet.
* Rust client generation exists today through `include_schema!` compile-time codegen.
* `frontends/vaam-mobile/pubspec.yaml` already uses local path dependencies.
* `frontends/vaam-mobile/rust/vaam_runtime` is the mobile-owned Rust runtime crate today.
* The schema uses model name `ProductOption` to avoid a Rust `Option<T>` collision while the product relation name remains `options`.
* Runtime DB alignment currently includes `0007_catalog_variant_table_alignment.sql` so the generated `Variant` model resolves against the `variants` table.

Important generator constraints already observed in this repo:

* `cratestack::include_schema!` is compile-time codegen, so schema problems can appear as a slow or seemingly stuck `cargo build`, not just as a clean validation error.
* Reverse relations that are not needed by the generated API can trigger large relation-order and relation-filter expansion costs. Prefer the smallest relation graph that still supports the generated routes and includes you actually use.
* Do not name schema models or types after common Rust prelude/container names such as `Option`, `Result`, `String`, or `Vec`. Generated code may resolve those names as schema models instead of Rust standard library types.

Implication:

* Dart package generation is already automated.
* For `vaam-mobile`, schema-typed client consumption now lives on the generated Dart side rather than a mobile Rust schema consumer crate.
* Mobile Rust still matters for generic request execution, signing, and upload prep, but not for schema-typed catalog APIs.

## Editor Setup

For `.cool` authoring in VS Code, prefer the first-party extension under `cratestack/packages/cratestack-vscode` plus the standalone `cratestack-lsp` binary.

Minimal local setup:

1. From `cratestack/`, run `cargo build -p cratestack-lsp`.
2. From `cratestack/packages/cratestack-vscode`, run `pnpm install` if needed.
3. Install or run the extension.
4. If the server is not already bundled or on `PATH`, set `cratestack.lsp.path` to the built binary.

For Rust-side autocomplete and hovers on generated `include_schema!` APIs, keep `rust-analyzer.procMacro.enable` on and point VS Code at the Cargo workspaces that compile the real schema consumer.

See `../tooling/editor-tooling.md` for the full current-state editor feature list and follow-up roadmap.

## Recommended File Layout

Recommended shared source-of-truth path:

* `vaam-backends/services/catalog-service/schema/catalog.cool`

Recommended consumer paths:

* Dart package: `frontends/vaam-mobile/packages/gen_catalog_client`
* Rust runtime crate: `frontends/vaam-mobile/rust/vaam_runtime`

This keeps:

* the backend-owned schema close to the catalog service
* the mobile Dart consumer inside the Flutter package tree that `pubspec.yaml` already uses
* the mobile Rust workspace focused on transport/runtime concerns instead of schema-typed catalog APIs

## Step 1: Author The First `catalog.cool` Schema

Start narrow.

Do not try to encode the entire `catalog-service` target interface on day one.

Use `vaam-backends/docs/service-interface/catalog-service.md` as the contract source and begin with one vertical slice such as:

* `Product`
* public `GET /products/{productId}`
* public `GET /products`
* generated `POST /products`, `PATCH /products/{productId}`, and `DELETE /products/{productId}`
* generated `Owner` and `Asset` resources backing product relations
* includes such as `ownerSummary` and `assets`
* special procedure routes for publish and upload flows

Recommended first file:

* `vaam-backends/services/catalog-service/schema/catalog.cool`

Suggested first-slice shape:

```cool
datasource db {
  provider = "postgresql"
  url = env("DATABASE_URL")
}

model Owner {
  id String @id @default(dbgenerated())
  ownerType String
  displayName String?
  nickname String?
  verified Boolean?

  @@allow("read", ownerType == "merchant" || auth() != null)
}

model Asset {
  id String @id @default(dbgenerated())
  productId String
  kind String
  storageKey String
  url String
  mimeType String
  width Int?
  height Int?
  blurHash String?
  sortOrder Int?

  @@allow("read", kind == "product_image" || auth() != null)
}

model Product {
  id String @id @default(dbgenerated())
  ownerType String
  ownerId String
  status String
  title String?
  description String?
  category String?
  condition String?
  currency String?
  priceMinor Int?
  stock Int?
  publishedAt DateTime?
  createdAt DateTime
  updatedAt DateTime
  version Int

  ownerSummary Owner @relation(fields:[ownerId],references:[id])
  assets Asset[] @relation(fields:[id],references:[productId])

  @@allow("read", status == "published" || auth() != null)
  @@allow("create", auth() != null)
  @@allow("update", auth() != null)
  @@allow("delete", auth() != null)
}

type PublishProductInput {
  productId String
}

mutation procedure publishProduct(args: PublishProductInput): Product
  @allow(auth() != null)
```

That is not the final catalog schema. It is only a good first end-to-end client slice.

Why this slice stays intentionally small:

* it keeps only the forward relations required by generated product includes
* it avoids reverse links that are attractive in a hand-written ORM model but expensive in the current code generator
* it keeps model names away from Rust standard library identifiers that can poison generated code

## Step 2: Validate The Schema

From `cratestack/`:

```bash
cargo run -p cratestack-cli -- check \
  --schema "../vaam-backends/services/catalog-service/schema/catalog.cool"
```

If this passes, CrateStack can consume the schema for both generated client paths.

If you need machine-readable diagnostics for editor fallback or CI glue, use:

```bash
cargo run -p cratestack-cli -- check \
  --schema "../vaam-backends/services/catalog-service/schema/catalog.cool" \
  --format json
```

Then immediately verify the real compile path from `vaam-backends/`:

```bash
cargo build -p catalog-service
```

Use this extra build step as a required guardrail, not an optional smoke test. `cratestack-cli -- check` validates schema structure, but it does not prove that the full Rust proc-macro expansion remains cheap enough or avoids Rust name collisions.

## Step 3: Keep Mobile Rust Generic

For `vaam-mobile`, do not create a schema-typed Rust consumer crate.

Keep `frontends/vaam-mobile/rust/vaam_runtime` focused on:

* request signing
* request execution
* upload preparation
* generic transport/codec bridging for the app's Dio stack

The schema-typed mobile client surface now lives in the generated Dart package, not a mobile Rust crate.

Verification from repo root:

```bash
cargo check --manifest-path "frontends/vaam-mobile/rust/Cargo.toml"
```

## Step 5.1: Host Auth Through `AuthProvider`

Generated CrateStack routers no longer need a route-local context resolver closure. The host application provides one `AuthProvider` implementation and registers it once.

Example from `vaam-backends/services/catalog-service/src/lib.rs`:

```rust
use cratestack::{AuthProvider, CoolContext, RequestContext, Value};

#[derive(Clone)]
struct CatalogAuthProvider;

impl AuthProvider for CatalogAuthProvider {
    type Error = cratestack::CoolError;

    fn authenticate(
        &self,
        request: &RequestContext<'_>,
    ) -> impl core::future::Future<Output = Result<CoolContext, Self::Error>> + Send {
        let mut fields = Vec::new();

        if let Some(role) = request.headers.get("x-role") {
            let role = role
                .to_str()
                .map_err(|error| cratestack::CoolError::BadRequest(error.to_string()));
            match role {
                Ok(role) => fields.push(("role".to_owned(), Value::String(role.to_owned()))),
                Err(error) => return core::future::ready(Err(error)),
            }
        }

        if let Some(id) = request.headers.get("x-auth-id") {
            let id = id
                .to_str()
                .map_err(|error| cratestack::CoolError::BadRequest(error.to_string()));
            match id {
                Ok(id) => fields.push(("id".to_owned(), Value::String(id.to_owned()))),
                Err(error) => return core::future::ready(Err(error)),
            }
        }

        core::future::ready(Ok(if fields.is_empty() {
            CoolContext::anonymous()
        } else {
            CoolContext::authenticated(fields)
        }))
    }
}
```

Register it once when building the generated router:

```rust
let router = cratestack_schema::axum::router(
    db,
    CatalogProcedures { state: state.clone() },
    CborCodec,
    CatalogAuthProvider,
);
```

For non-HTTP Rust callers, bind auth directly instead:

```rust
let bound = db.bind_auth(Some(serde_json::json!({
    "id": "vendor_123",
    "role": "merchant",
})))?;

let products = bound.product().find_many().run().await?;
```

For newer integrations, prefer binding structured principals when actor/session/tenant concepts exist. CrateStack still projects those values through legacy `auth().field` lookups so existing schemas do not need to change immediately.

## Step 6: Generate The Dart Package

From `cratestack/`:

```bash
cargo run -p cratestack-cli -- generate-dart \
  --schema "../vaam-backends/services/catalog-service/schema/catalog.cool" \
  --out "../frontends/vaam-mobile/packages/gen_catalog_client" \
  --library-name gen_catalog_client \
  --base-path "/api"
```

This creates a Flutter-shaped package under:

* `frontends/vaam-mobile/packages/gen_catalog_client`

Re-run that same command any time the source `.cool` schema changes or the Dart generator/templates change. Generated packages are materialized output, so enum additions or other type-shape changes do not appear in `gen_catalog_client` until you regenerate it.

For example, after adding:

```cool
enum OwnerType {
  merchant
  user
}

model Product {
  id String @id
  ownerType OwnerType
}
```

you need to rerun `generate-dart` before `gen_catalog_client` exposes `OwnerType` in its Dart API.

The generated output is a real Flutter-style package, not a single loose Dart file. Expect:

* `pubspec.yaml`
* `README.md`
* `CHANGELOG.md`
* `analysis_options.yaml`
* `lib/gen_catalog_client.dart`
* `lib/src/...`
* `example/main.dart`
* `test/gen_catalog_client_test.dart`

If the schema declares enums, the generated package now emits real Dart `enum` types in `lib/src/models.dart` and uses them across generated inputs, projected wrappers, and procedure surfaces.

Example generated Dart shape:

```dart
enum OwnerType {
  merchant('merchant'),
  user('user');

  const OwnerType(this.wireName);

  final String wireName;

  Object toWire() => wireName;
}

class Product {
  const Product({required this.id, required this.ownerType});

  final String id;
  final OwnerType ownerType;
}
```

## Step 7: Import The Dart Package Into `vaam-mobile`

Update `frontends/vaam-mobile/pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter

  gen_catalog_client:
    path: packages/gen_catalog_client

  vaam_auth_signing:
    path: ../vaam_auth_signing
  vaam_upload_prep:
    path: ../vaam_upload_prep
  flutter_riverpod: ^3.3.1
  go_router: ^17.2.2
  dio: ^5.8.0+1
  ffi: ^2.2.0
  flutter_secure_storage: ^10.0.0
  path_provider: ^2.1.5
```

Then run:

```bash
flutter pub get
```

## Step 8: Wire The Generated Runtime Bridge In Flutter

The generated package expects a `CrateStackRuntimeBridge` implementation plus provider overrides.

Minimal bridge shape:

```dart
import 'package:gen_catalog_client/gen_catalog_client.dart';

final class CatalogBridge implements CrateStackRuntimeBridge {
  @override
  Future<CrateStackBridgeResponse> execute(
    CrateStackBridgeRequest request, {
    CrateStackCallOptions? options,
  }) async {
    throw UnimplementedError();
  }
}
```

Provider wiring shape:

```dart
ProviderScope(
  overrides: [
    genCatalogClientRuntimeBridgeProvider.overrideWith((ref) => CatalogBridge()),
    genCatalogClientBasePathProvider.overrideWith((ref) => '/api'),
  ],
  child: const App(),
)
```

## Step 9: Use The Generated Dart Client

Example projected read:

```dart
import 'package:gen_catalog_client/gen_catalog_client.dart';

Future<void> fetchCatalogProduct(GenCatalogClientCrateStackClient client) async {
  final selection = ProductSelection()
    ..id()
    ..title()
    ..status()
    ..priceMinor()
    ..ownerSummary((owner) {
      owner.displayName();
      owner.nickname();
    })
    ..assets((asset) {
      asset.id();
      asset.kind();
      asset.url();
    });

  final product = await client.products.getView(
    'prod_123',
    projection: selection.asProjection(),
  );

  final title = product.title;
  final status = product.status;
  final owner = product.ownerSummary?.displayName;
  final assetCount = product.assets?.length;
  _ = (title, status, owner, assetCount);
}
```

Repo-local Flutter example path:

* `frontends/vaam-mobile/lib/src/features/discovery/data/catalog_client_example.dart`

That file shows the intended app-side pattern:

* override `genCatalogClientRuntimeBridgeProvider`
* override `genCatalogClientBasePathProvider` to `''` for the current catalog service
* consume generated projected reads and procedures through a small app-owned facade

This uses the current generated Dart surface accurately:

* `getView` / `listView`
* selection builders
* projected wrapper objects
* projection builders flattened into canonical query params by the generated package
* generated procedure methods for special flows such as publish and uploads
* generated relation wrappers for `ownerSummary` and `assets`
* Riverpod integration through the generated adapter and base-path providers

## Step 10: Recommended First E2E Scope

For the first real repo adoption, keep the scope narrow:

1. one backend-owned schema file at `vaam-backends/services/catalog-service/schema/catalog.cool`
2. one Dart package at `frontends/vaam-mobile/packages/gen_catalog_client`
3. one Rust runtime crate at `frontends/vaam-mobile/rust/vaam_runtime`
4. one projected product fetch in Flutter
5. one Dio-to-Rust transport verification path in the mobile runtime wiring

That is enough to validate:

* schema shape
* backend contract alignment
* Dart package generation path
* first real schema ownership and client import ergonomics
* mobile transport/runtime integration ergonomics

## Known Gaps

This guide is accurate to the current repo, but these gaps still matter:

* `catalog-service` is still an early slice, so the schema should keep growing in narrow vertical steps
* exact type-level projection remains stronger on Rust than on Dart
* this first schema intentionally avoids `/products/mine` and other owner-specific convenience routes
* special flows such as `publish` and uploads now live as generated CrateStack procedures rather than manual handlers
* request-authorizer hooks exist in Rust, but full COSE transport completion is still deferred
* current generated backend routing uses the CBOR codec path rather than the older JSON fallback behavior
* current generated backend auth is intentionally simplified to header/context-based auth for this slice
* the generated Dart package now depends on an app-provided adapter seam; host apps still own Dio stack composition and interceptor policy
* the mobile Rust transport path is currently generic and request-driven rather than schema-native
* the Flutter-facing wrapper does not yet expose persisted state or runtime-configurable SQLite selection through the public Dart-facing surface

## Recommended Next Follow-Up

After this guide is used once for real, the highest-value follow-up is:

1. extend `schema/catalog.cool` to the next real catalog slice
2. regenerate `frontends/vaam-mobile/packages/gen_catalog_client`
3. keep the mobile adapter/interceptor wiring aligned with the regenerated package
4. record the friction points
5. decide whether the next improvement should be:
    - public-read/protected-write router splitting in CrateStack
    - JSON fallback for generated backend routes
    - better shared schema placement/tooling
    - tighter mobile runtime integration
