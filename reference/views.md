---
title: Views
description: Reference for the `view` block — read-only SQL projections of one or more models, with per-backend SQL bodies and optional materialization.
---

# Views

A `view` declares a **read-only, SQL-defined projection** over one or more existing `model` blocks. Views generate a typed Rust struct, a `ViewDelegate` with `find_many` / `find_unique`, and `CREATE VIEW` DDL during migration generation.

For the rationale, see [ADR 0003](../internals/views-adr).

## Minimal example

```cstack
view ActiveCustomer from Customer, Order {
  id          Int       @id  @from(Customer.id)
  email       String         @from(Customer.email)
  orderCount  Int

  @@sql("""
    SELECT c.id, c.email, COUNT(o.id) AS order_count
    FROM   customer c
    LEFT JOIN "order" o ON o.customer_id = c.id
    GROUP  BY c.id, c.email
  """)

  @@allow("read", auth() != null)
}
```

## Block header

```
view <Name> from <Model>, <Model>, …
```

* `<Name>` — PascalCase. Becomes the Rust struct name and the SQL view identifier (snake-cased).
* `from <Model>, …` — the **source-model dependency list**. Every model referenced in the SQL body must be listed here. The parser validates each name exists. The list also orders view DDL after source-model DDL during [migration generation](../internals/schema-diff-adr).

Listing a model in `from` that the SQL body doesn't actually use is a parse-time warning. Referencing a model in the SQL body that isn't in `from` is a parse-time error — but only for models the parser can detect by name; the SQL itself is not parsed.

## Fields

Fields use the same syntax as model fields, plus two view-specific attributes.

### `@id` (required)

Exactly one field must carry `@id`. Required for `find_unique` and (when `@@materialized` is set) the unique index that backs concurrent refresh.

Views without a natural unique key opt out:

```cstack
view RevenueByDay from Order {
  day      Date
  revenue  Decimal

  @@no_unique
  @@sql("…")
}
```

`@@no_unique` drops `find_unique` from the generated delegate and is **incompatible with `@@materialized`** (see below).

### `@from(Model.field)`

Binds a view column to a typed source field on one of the `from` models. Lets the parser:

* validate that `Model.field` exists,
* check the Rust type of the view column matches the source field,
* propagate column-level policies if the source field has any.

`@from` is optional. Columns without it are **computed** — the developer declares the Rust type and the macro trusts the SQL.

```cstack
view ActiveCustomer from Customer, Order {
  id          Int       @id  @from(Customer.id)   // bound
  email       String         @from(Customer.email) // bound
  orderCount  Int                                  // computed
}
```

## SQL body attributes

A view must declare at least one of `@@server_sql`, `@@embedded_sql`, or `@@sql`.

### `@@server_sql("…")` and `@@embedded_sql("…")`

Per-backend SQL bodies. Required when the dialects diverge — Postgres aggregate casts (`COUNT(o.id)::int`), `DISTINCT ON`, JSON functions, window function variants, and many others are not portable to SQLite.

If only one is declared, the view is **backend-specific**. Building the other target with this view in scope is a clear compile error pointing at the missing attribute.

### `@@sql("…")`

Shorthand that applies to both backends. The macro emits a `cargo` warning that single-string portability is the developer's responsibility. Use only when the SQL body is genuinely a portable subset.

## `@@allow("read", …)`

Same authorization machinery as models, but **only the `"read"` action is supported**. Any other action (`"create"`, `"update"`, `"delete"`) is a parse-time error — views are not writable.

```cstack
@@allow("read", auth() != null)
@@allow("read", auth().role == "admin")
```

Multiple `@@allow("read", …)` rules combine with OR, same as on models.

## `@@materialized` (server-only)

Marks the view as a Postgres materialized view. Server-only — building this view with the embedded backend enabled is a **hard compile error** referencing [ADR 0003](../internals/views-adr). There is no silent fallback to a regular view.

```cstack
view AccountBalance from Account, Transfer {
  accountId Uuid     @id  @from(Account.id)
  balance   Decimal

  @@materialized
  @@server_sql("""
    SELECT a.id AS account_id,
           a.opening_balance
           + COALESCE(SUM(t.amount), 0) AS balance
    FROM   account a
    LEFT JOIN transfer t ON t.account_id = a.id
    GROUP  BY a.id, a.opening_balance
  """)

  @@allow("read", auth().id == accountId)
}
```

When `@@materialized` is set:

* The generated delegate gains a `pub async fn refresh(&self) -> Result<()>` method that emits `REFRESH MATERIALIZED VIEW CONCURRENTLY <name>`.
* The migration emits `CREATE MATERIALIZED VIEW <name> …` plus `CREATE UNIQUE INDEX <name>_pkey ON <name> (<id_column>)` to back the concurrent refresh.
* `@@no_unique` is rejected: concurrent refresh requires a unique index, and CrateStack will not silently downgrade to a non-concurrent refresh that takes `ACCESS EXCLUSIVE`.

Refresh is **never automatic**. See the [Materialized views guide](../guides/materialized-views) for refresh trigger patterns.

## Generated surface

For a view named `ActiveCustomer`, the macro emits:

```rust
pub struct ActiveCustomer {
    pub id: i32,
    pub email: String,
    pub order_count: i32,
}

// On the runtime:
runtime.views().active_customer()       // -> ViewDelegate<'_, ActiveCustomer, i32>
    .find_many()
    .where_(/* … */)
    .execute()
    .await?;

runtime.views().active_customer()
    .find_unique(customer_id)
    .execute()
    .await?;
```

Views never expose `insert`, `update`, or `delete`. This is enforced at the **type level** — the `ViewDescriptor` does not implement the `WriteSource` trait that powers write builders.

## Parse-time validation summary

| Rule | Failure mode |
| --- | --- |
| Exactly one `@id` field, or `@@no_unique` | Parse error |
| Every `@from(M.f)` references a model in `from` | Parse error |
| `M.f` exists on the referenced model | Parse error |
| Field type matches `M.f` type | Parse error |
| At least one of `@@server_sql` / `@@embedded_sql` / `@@sql` | Parse error |
| `@@allow` action is `"read"` | Parse error otherwise |
| `@@materialized` + `@@no_unique` | Parse error |
| `@@materialized` requires `@@server_sql` (not `@@sql` alone) | Parse error |
| `@@materialized` + embedded build target | Compile error referencing [ADR 0003](../internals/views-adr) |

## Read Next

1. [Materialized views guide](../guides/materialized-views) — when and how to call `refresh()`
2. [ADR 0003: SQL views as projections of models](../internals/views-adr) — design rationale
3. [Migrations](../guides/migrations) — how view DDL flows through the migration runner
