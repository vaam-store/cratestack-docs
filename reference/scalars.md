---
title: Scalars
description: Built-in scalar types, including the selectable Decimal backend for monetary fields.
---

# Scalars

The `.cstack` parser recognises a fixed set of scalar names. Each maps
to a Rust type, a SQL column type, and (where relevant) a serde
representation.

## Built-in scalars

| Scalar     | Rust type                        | Postgres type     | Notes                                                  |
|------------|----------------------------------|-------------------|--------------------------------------------------------|
| `String`   | `String`                         | `TEXT`            |                                                        |
| `Cuid`     | `String`                         | `TEXT`            | Validated as a CUID at the framework boundary.         |
| `Int`      | `i64`                            | `BIGINT`          |                                                        |
| `Float`    | `f64`                            | `DOUBLE PRECISION`| Avoid for money — use `Decimal`.                       |
| `Boolean`  | `bool`                           | `BOOLEAN`         |                                                        |
| `DateTime` | `chrono::DateTime<chrono::Utc>`  | `TIMESTAMPTZ`     |                                                        |
| `Decimal`  | `cratestack::Decimal`            | `NUMERIC`         | See backend selection below.                           |

Type modifiers `?` (optional) and `[]` (list) apply on top of any scalar
where the underlying SQL type supports it.

## Decimal

The `Decimal` scalar exists specifically so banking code does **not** end
up using `Float` for money. Round-trip through `NUMERIC` is exact for
any value the chosen backend supports.

### Backend selection

The workspace ships two backends, gated by feature flag:

| Feature                  | Backend             | Type alias                     |
|--------------------------|---------------------|--------------------------------|
| `decimal-rust-decimal`   | `rust_decimal`      | `pub type Decimal = rust_decimal::Decimal;` |
| `decimal-bigdecimal`     | `bigdecimal`        | `pub type Decimal = bigdecimal::BigDecimal;` |

Default: `decimal-rust-decimal`.

Banks pick:

1. **rust_decimal** for fixed 128-bit precision, faster arithmetic, and a
   smaller binary. 28–29 significant digits is enough for retail banking,
   FX rates, and consumer-facing pricing.
2. **bigdecimal** for arbitrary precision when calculations involve
   cumulative compounding, very long-duration interest, or settlement
   workflows where the precision budget grows over time.

Exactly one backend must be enabled. The umbrella `cratestack` crate
threads the feature through the workspace so downstream code references
`cratestack::Decimal` regardless of backend.

### Serialization

`Decimal` serializes as a **JSON string**, not a number. This is
deliberate:

```json
{"amount": "1234.5600", "currency": "USD"}
```

A JSON number would round-trip through every consumer's `f64` parser and
lose precision. Banks that consume CrateStack responses from other
languages have one well-defined parse path: read the string, parse with
that language's exact-decimal library.

### Use with validators

`@range(min, max)` on a `Decimal` field promotes the integer bounds to
Decimal at runtime. `@range(min: 0, max: 1000000)` on
`amount Decimal` accepts `123.45`, rejects `-0.01`, and rejects
`1000000.01`.

See [validators](../guides/validators) for the broader validator surface.

## Choosing types for money

The recommended pattern:

```cstack
model Transfer {
  id Int @id
  amount Decimal @range(min: 0)
  currency String @iso4217
  reference String @length(min: 1, max: 64)
  version Int @version

  @@audit
}
```

Notes:

1. amounts are always `Decimal`, never `Float`
2. currency is always `String @iso4217`, not an enum — currency lists churn
3. `@version` is required for any row that two callers can race on
4. `@@audit` is required for any row a regulator can ask about
