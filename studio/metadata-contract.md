## Metadata Contract

This is the foundation layer for each generated Studio app.

If this contract is weak, the generated Yew app becomes stringly, fragile, and full of special cases.

If this contract is good, every per-schema Studio app gets boring in the best possible way. 🧱

## Goal

Expose one generated metadata document for the target schema service that describes:

1. models
2. fields
3. enums
4. relations
5. procedures
6. paging support
7. route transport information

## Existing Pieces We Already Have

Today the repo already exposes useful fragments through generated Rust:

1. `schema_summary()`
2. `ROUTE_TRANSPORTS`
3. `ModelDescriptor.allowed_fields`
4. `ModelDescriptor.allowed_includes`

That is a good start, but it is not yet enough for a Studio app generator.

## Proposed Shape

```json
{
  "service": "payment-gateway",
  "schemaPath": "services/payment-gateway/schema/payment.cstack",
  "mountPath": "/studio",
  "models": [
    {
      "name": "PaymentInstrument",
      "primaryKey": "id",
      "paged": false,
      "fields": [
        {
          "name": "id",
          "kind": "scalar",
          "type": "String",
          "required": true,
          "filterable": true,
          "sortable": true,
          "createAllowed": true,
          "updateAllowed": false
        },
        {
          "name": "status",
          "kind": "scalar",
          "type": "PaymentInstrumentStatus",
          "required": true,
          "enumName": "PaymentInstrumentStatus",
          "enumValues": ["active", "inactive"],
          "filterable": true,
          "sortable": true,
          "createAllowed": true,
          "updateAllowed": true
        }
      ],
      "relations": []
    }
  ],
  "enums": [
    {
      "name": "PaymentInstrumentStatus",
      "values": ["active", "inactive"]
    }
  ],
  "procedures": [
    {
      "name": "registerPaymentInstrument",
      "kind": "mutation",
      "argsType": "RegisterPaymentInstrumentArgs",
      "returnType": "PaymentInstrument"
    }
  ],
  "routes": [
    {
      "name": "paymentInstrument.list",
      "method": "GET",
      "path": "/payment-instruments"
    }
  ]
}
```

## Required Model Metadata

Each model should expose:

1. `name`
2. `primaryKey`
3. `paged`
4. `allowedFields`
5. `allowedIncludes`
6. `fields`
7. `relations`
8. `defaultSort` if one is introduced later

## Required Field Metadata

Each field should expose:

1. `name`
2. `kind`: `scalar` or `relation`
3. `type`
4. `required`
5. `list`
6. `enumName` when applicable
7. `enumValues` when applicable
8. `filterable`
9. `sortable`
10. `createAllowed`
11. `updateAllowed`
12. `custom`

## Required Relation Metadata

Each relation should expose:

1. `name`
2. `targetModel`
3. `cardinality`: `one` or `many`
4. `localField`
5. `targetField`
6. `includeAllowed`

## Required Procedure Metadata

Each procedure should expose:

1. `name`
2. `kind`: `query` or `mutation`
3. `argsType`
4. `returnType`
5. `returnKind`: `scalar`, `model`, `type`, `page`, or `list`

## Nice Extras Later

1. doc comments for fields and procedures
2. generated labels and descriptions for admin UI
3. display hints such as `multiline`, `json`, `currency`, `datetime`, `badge`
4. relation preview hints such as `titleField`
5. procedure grouping such as `catalog`, `checkout`, `vendor-team`

## Where It Should Come From

Prefer generated metadata from the same `include_server_schema!` path that already creates:

1. model descriptors
2. route metadata
3. schema summaries

The next generated piece should be a Studio metadata export, for example:

1. `cratestack_schema::studio::metadata()`
2. `cratestack_schema::studio::service_name()`
3. `cratestack_schema::studio::mount_defaults()`

That keeps schema truth in one place.

If the metadata has to be hand-maintained, it will eventually lie. Computers love helping with that. 🤖
