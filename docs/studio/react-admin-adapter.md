## React Admin Adapter

The React Admin story should be an adapter, not a separate universe.

Goal:

1. build `coolstack-react-admin`
2. use the same metadata contract as Studio
3. use the same relay or transport layer as Studio

If Studio and React Admin diverge at the metadata boundary, one of them will become weird first and the other will catch up later. Usually at 4:47 PM on a Friday.

## Core Surface

Proposed package surface:

```ts
export type CoolstackAdminClientConfig = {
  baseUrl: string
  service: string
  authProvider?: CoolstackAdminAuthProvider
}

export function buildCoolstackDataProvider(
  config: CoolstackAdminClientConfig,
): DataProvider

export async function buildResourcesFromMetadata(
  config: CoolstackAdminClientConfig,
): Promise<ResourceDefinition[]>
```

## DataProvider Mapping

Map React Admin operations to CoolStack like this:

1. `getList` -> model `list`
2. `getOne` -> model `get`
3. `create` -> model `create`
4. `update` -> model `update`
5. `delete` -> model `delete`

## Query Translation

React Admin concepts need a CoolStack translation layer:

1. pagination -> `limit` and `offset`
2. sorting -> `sort`
3. filters -> `where` plus direct scalar filters where supported
4. field selection -> generated default resource projection

## Enum Handling

Enums are a strong reason to use metadata-driven form generation.

Example metadata:

```json
{
  "name": "status",
  "type": "PaymentInstrumentStatus",
  "enumValues": ["active", "inactive"]
}
```

React Admin rendering:

1. use `SelectInput` for forms
2. use `SelectField` or badge-style formatting for read views

## Resource Definition Example

```ts
export async function buildResourcesFromMetadata() {
  return [
    {
      name: 'PaymentInstrument',
      list: PaymentInstrumentList,
      edit: PaymentInstrumentEdit,
      create: PaymentInstrumentCreate,
      show: PaymentInstrumentShow,
    },
  ]
}
```

## CoolStack-Native Extras

Do not stop at generic CRUD.

The adapter should also support:

1. procedure buttons on resource pages
2. relation-aware reference widgets
3. enum-aware inputs
4. paged-model awareness for `@@paged`
5. request metadata for debugging

## Example Action

For `PaymentInstrument`, a React Admin detail page could expose:

1. standard edit form
2. "Deactivate" procedure action
3. raw request preview
4. raw response preview

That is more useful than a generic admin scaffold because CoolStack already has procedures as part of the contract.

## Recommended Scope For V1

1. one service at a time
2. list, show, edit, create, delete
3. enum-aware forms
4. simple relation rendering
5. optional procedure action buttons

## Not In V1

1. cross-service joined resources
2. automatic inference of every possible custom widget
3. full policy explanation UI
4. offline or persisted admin state

V1 should prove that React Admin can sit on top of CoolStack cleanly. It does not need to become sentient. 🧠
