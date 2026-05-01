## CoolStack Studio

Short version: this is the folder for the "Prisma Studio, but for CoolStack" idea. ✨

It is also where the "Prisma x React Admin, but for CoolStack" idea lives.

The recommendation is to build one shared platform and put two UIs on top of it:

1. `coolstack-studio`
2. `coolstack-react-admin`

Why one platform first?

Because the expensive parts are the same:

1. schema metadata
2. enum metadata
3. relation metadata
4. procedure metadata
5. transport wiring
6. auth and signing
7. query and paging translation

If those get built twice, the repo will earn a second admin system and a first-class maintenance headache. 😄

## What Belongs Here

1. [Metadata Contract](./metadata-contract.md)
2. [Relay API](./relay-api.md)
3. [React Admin Adapter](./react-admin-adapter.md)
4. [Studio MVP](./mvp.md)

## Design Rules

1. Studio is HTTP-first, not DB-direct.
2. Policies are part of the product, not an inconvenience to tunnel around.
3. Procedures are first-class citizens, not "misc buttons somewhere later".
4. Signed requests are a platform concern, so the UI should not have to hand-roll them.
5. Generated metadata should be the source of truth for model, enum, relation, and procedure shape.

## Why This Is Not Just Prisma Studio

Prisma Studio mainly assumes local database access plus model CRUD.

CoolStack needs more:

1. multiple services
2. signed HTTP requests
3. read and write policies
4. procedures beside CRUD
5. projection and include behavior
6. transport inspection

So the target is closer to:

1. Prisma Studio
2. plus Postman
3. plus an auth-context simulator
4. plus a schema explorer

That sounds like a lot because it is a lot. But it is also where CoolStack gets to be interesting instead of just being a table browser with better branding. 🚀
