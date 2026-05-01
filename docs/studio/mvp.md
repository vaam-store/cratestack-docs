## Studio MVP

This is the first useful version of `coolstack-studio`.

The right bar is not "clone Prisma Studio".

The right bar is:

1. useful for real local and internal workflows
2. obviously better than raw curl or ad hoc admin scripts
3. generated from one `.cool` file into a runnable full-stack app

## MVP Screens

### 1. Schema Header

Show:

1. service name
2. schema path
3. configured service URL
4. mount path
5. backend health

Because the first unit is one schema-scoped Studio app, not a multi-service control room.

### 2. Schema Explorer

Show:

1. models
2. fields
3. enums
4. relations
5. procedures

This is the "what even exists here?" screen.

### 3. Model List View

Show:

1. list table
2. paging controls
3. sort controls
4. filter controls
5. visible-column chooser

### 4. Record Detail View

Show:

1. scalar fields
2. included relation previews
3. raw JSON tab
4. edit action
5. delete action

### 5. Create/Edit Form

Support:

1. generated scalar inputs
2. enum select inputs
3. JSON textarea for `Json` fields
4. nullable field controls

### 6. Procedure Runner

Show:

1. procedure list
2. argument form
3. response viewer
4. error viewer

This is one of the biggest product differences from Prisma Studio.

### 7. Request Inspector

Show:

1. method
2. path
3. query params
4. headers summary
5. codec
6. signed or unsigned status
7. response status

This is the "why did that happen?" screen.

### 8. Auth Context Switcher

Show:

1. anonymous mode
2. service mode
3. custom dev context mode

This is the feature that makes the Studio feel like CoolStack rather than a generic CRUD panel.

## Best First Schema Demos

1. `auth-service`
2. `payment-gateway`
3. `vendor-service`

Why:

1. they have enums or procedures already worth showing
2. they exercise policy and admin-like flows
3. they make the Studio feel real quickly

## Suggested Build Order

1. generated backend shell
2. Yew asset serving
3. schema header
2. schema explorer
3. model list view
4. record detail view
5. create/edit form
6. procedure runner
7. request inspector
8. auth context switcher

## Success Criteria

The MVP is successful if a developer can:

1. inspect service metadata
2. browse model rows
3. edit a record with enum fields
4. run a procedure
5. understand what request was sent
6. switch auth context in a safe dev flow

## First Generated Command To Optimize For

```bash
coolstack generate-studio \
  --schema "../vaam-backends/services/auth-service/schema/auth.cool" \
  --out "../tools/studios/auth-service-studio" \
  --name auth-service-studio \
  --service-url "http://127.0.0.1:8081" \
  --mount-path "/studio"
```

If that command produces a runnable Studio with working metadata, list view, and procedure runner, the MVP is alive.

## Nice Future Tricks

1. policy-denial explanation panel
2. projection builder UI
3. relation graph explorer
4. stored query presets
5. compare request runs across auth contexts

That future version will be fun.

The MVP version should mostly be useful.

Useful wins first. Fancy can show up wearing sunglasses later. 😎
