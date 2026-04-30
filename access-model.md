# Ergonomic Nullability Design for a Rust-Based ZenStack-Style Generated Client

## 1. Context

You are building a ZenStack-like code generation system, but the generated client and runtime are written 100% in Rust.
The goal is to use this generated client on the client side, with target consumers such as:

* Rust client-side code
* Flutter / Dart
* React Native / TypeScript
* Next.js / TypeScript

The main design problem is Rust's strict and explicit handling of optional data. Rust naturally represents nullable or
missing values as `Option<T>`, which is correct and safe, but can become painful in application code when generated
models contain many optional fields.

The question is how to keep Rust's safety while avoiding code like this everywhere:

```rust
user.name.as_ref().unwrap_or( & "".to_string())
user.profile.as_ref().unwrap().avatar_url.as_ref()
```

The core answer is:

> Do not make the raw database/query model the only model exposed to app developers.

Instead, generate multiple layers of types and use traits, projection-specific result structs, and client-specific DTOs
to make the API ergonomic.

---

## 2. Design Goals

The generated client should satisfy these goals:

1. Preserve Rust correctness and type safety.
2. Avoid unnecessary `Option<T>` usage in application code.
3. Distinguish between:

    * a nullable value,
    * a field that was not selected,
    * a relation that was not loaded,
    * an empty value that can safely default.
4. Generate idiomatic APIs for each target language.
5. Make common UI and application patterns simple.
6. Let query shape drive return type whenever possible.
7. Avoid lying to the type system.

The most important principle is:

> Use optionality only for real domain absence, not for every kind of missing data.

---

## 3. Core Principle: Query Shape Should Drive Return Type

A generated client should not return one giant `User` type for every query.

Instead, the selected fields should determine the return type.

For example:

```rust
let user = client.user()
.find_unique(id)
.select(user::card())
.exec()
.await?;
```

This should return a projection-specific type:

```rust
pub struct UserCard {
    pub id: String,
    pub name: String,
    pub avatar_url: Option<String>,
}
```

If the query does not select `profile`, then the returned type should not contain a `profile` field at all.

This avoids ambiguity. A missing field should not be represented as `None` if it was never selected.

Bad design:

```rust
pub struct User {
    pub id: String,
    pub name: Option<String>,
    pub profile: Option<Profile>,
}
```

In this model, `profile: None` may mean:

* the profile was not selected,
* the user has no profile,
* the profile failed to load,
* the value was not available in the transport layer.

Those are different states and should not all collapse into `Option<T>`.

Better design:

```rust
pub struct UserBase {
    pub id: String,
}

pub struct UserCard {
    pub id: String,
    pub name: String,
    pub avatar_url: Option<String>,
}

pub struct UserWithProfile {
    pub id: String,
    pub name: String,
    pub profile: Option<Profile>,
}
```

In `UserWithProfile`, `profile: Option<Profile>` now has a clear meaning:

> The profile relation was selected, but the user may or may not have a profile.

---

## 4. Recommended Nullability Mapping

Use the following mapping rules.

| Concept                             | Rust                                             | Dart         | TypeScript   |
|-------------------------------------|--------------------------------------------------|--------------|--------------|
| Required scalar                     | `T`                                              | `T`          | `T`          |
| Nullable scalar                     | `Option<T>`                                      | `T?`         | `T \| null`  |
| Required relation                   | `T`                                              | `T`          | `T`          |
| Optional relation selected by query | `Option<T>`                                      | `T?`         | `T \| null`  |
| List relation                       | `Vec<T>`                                         | `List<T>`    | `T[]`        |
| Field not selected                  | Field absent                                     | Field absent | Field absent |
| Relation not included               | Field absent or `Relation::NotLoaded` internally | Field absent | Field absent |
| Empty string allowed                | `String`                                         | `String`     | `string`     |
| Empty list allowed                  | `Vec<T>`                                         | `List<T>`    | `T[]`        |
| Domain absence                      | `Option<T>`                                      | `T?`         | `T \| null`  |

Main rule:

> Use `Option<T>` only when absence is meaningful in the domain.

Avoid `Option<T>` for:

* fields that were not selected,
* relations that were not included,
* empty lists,
* empty strings,
* values that can be defaulted at the schema or DTO boundary.

---

## 5. Layered Architecture

The generated system should have at least three layers.

### 5.1 Raw Rust Layer

The raw layer represents the accurate database or query result shape.

This layer is internal or low-level.

```rust
pub struct UserRaw {
    pub id: String,
    pub name: Option<String>,
    pub profile: Relation<ProfileRaw>,
}
```

This layer can be very strict and explicit. It is allowed to use `Option<T>` heavily because it is not necessarily the
main application-facing API.

### 5.2 Projection-Specific Rust Layer

This is the main Rust developer-facing layer.

Each query projection generates a precise result type.

```rust
pub struct UserCard {
    pub id: String,
    pub name: String,
    pub avatar_url: Option<String>,
}

pub struct UserDetails {
    pub id: String,
    pub name: String,
    pub email: String,
    pub profile: Option<Profile>,
}
```

This layer removes unnecessary optionality by only exposing fields that were selected.

### 5.3 Client DTO Layer

This layer is for Dart, TypeScript, JSON, FFI, or WebAssembly boundaries.

For Dart:

```dart
class UserCard {
  final String id;
  final String name;
  final String? avatarUrl;

  const UserCard({
    required this.id,
    required this.name,
    this.avatarUrl,
  });
}
```

For TypeScript:

```ts
type UserCard = {
    id: string
    name: string
    avatarUrl: string | null
}
```

This layer should be idiomatic for the target platform rather than a direct mirror of Rust internals.

---

## 6. Leveraging Traits in Rust

Traits can make generated Rust models much more ergonomic.

They are especially useful when multiple projection types share fields or concepts.

### 6.1 Field Traits

Generate traits for common fields:

```rust
pub trait HasId {
    type Id;

    fn id(&self) -> &Self::Id;
}

pub trait HasName {
    fn name(&self) -> &str;
}

pub trait HasEmail {
    fn email(&self) -> &str;
}
```

Then projection types implement them:

```rust
pub struct UserCard {
    pub id: String,
    pub name: String,
    pub avatar_url: Option<String>,
}

impl HasId for UserCard {
    type Id = String;

    fn id(&self) -> &Self::Id {
        &self.id
    }
}

impl HasName for UserCard {
    fn name(&self) -> &str {
        &self.name
    }
}
```

This allows reusable code over many generated types:

```rust
fn render_label<T>(item: &T) -> String
where
    T: HasId + HasName,
{
    format!("{}: {}", item.id(), item.name())
}
```

### 6.2 Relation Traits

Generate traits for selected relations:

```rust
pub trait HasProfile {
    fn profile(&self) -> Option<&Profile>;
}

pub trait HasPosts {
    fn posts(&self) -> &[Post];
}
```

Only types that actually include those relations implement the traits.

```rust
pub struct UserWithProfile {
    pub id: String,
    pub name: String,
    pub profile: Option<Profile>,
}

impl HasProfile for UserWithProfile {
    fn profile(&self) -> Option<&Profile> {
        self.profile.as_ref()
    }
}
```

This lets the compiler enforce relation availability:

```rust
fn render_profile<T>(user: &T)
where
    T: HasName + HasProfile,
{
    println!("{}", user.name());

    if let Some(profile) = user.profile() {
        println!("{}", profile.bio());
    }
}
```

A `UserBase` that did not select `profile` simply cannot be passed to this function.

That is better than discovering at runtime that `profile` was not loaded.

### 6.3 Extension Traits for `Option<T>`

Traits can also reduce repetitive optional handling.

```rust
pub trait OptionStrExt {
    fn or_empty(&self) -> &str;
    fn required(&self, field: &'static str) -> Result<&str, ClientError>;
}

impl OptionStrExt for Option<String> {
    fn or_empty(&self) -> &str {
        self.as_deref().unwrap_or("")
    }

    fn required(&self, field: &'static str) -> Result<&str, ClientError> {
        self.as_deref()
            .ok_or(ClientError::MissingField(field))
    }
}
```

Usage:

```rust
let name = user.name.or_empty();
let bio = user.bio.required("bio") ?;
```

For generic optional values:

```rust
pub trait OptionExt<T> {
    fn required(&self, field: &'static str) -> Result<&T, ClientError>;
}

impl<T> OptionExt<T> for Option<T> {
    fn required(&self, field: &'static str) -> Result<&T, ClientError> {
        self.as_ref().ok_or(ClientError::MissingField(field))
    }
}
```

Usage:

```rust
let profile = user.profile.required("profile") ?;
```

### 6.4 Generated Getters

Another ergonomic option is to generate getters that internally use extension traits.

```rust
impl UserCard {
    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn avatar_url(&self) -> Option<&str> {
        self.avatar_url.as_deref()
    }
}
```

For raw or nullable models:

```rust
impl UserRaw {
    pub fn name(&self) -> &str {
        self.name.or_empty()
    }

    pub fn name_opt(&self) -> Option<&str> {
        self.name.as_deref()
    }

    pub fn name_required(&self) -> Result<&str, ClientError> {
        self.name.required("name")
    }
}
```

This gives developers three access styles:

```rust
user.name()           // defaulting accessor
user.name_opt()       // explicit optional accessor
user.name_required() ? // checked required accessor
```

---

## 7. Handling Relations in Rust

Relations are often more complicated than scalar fields because `Option<T>` can become ambiguous.

For example:

```rust
pub profile: Option<Profile>
```

could mean:

1. The profile relation was selected and is null.
2. The profile relation was not selected.
3. The profile relation failed to load.

These should not be treated as the same state.

### 7.1 Relation Enum

Internally, use a dedicated relation type:

```rust
pub enum Relation<T> {
    NotLoaded,
    Null,
    Loaded(T),
}
```

Then define an extension trait:

```rust
pub trait RelationExt<T> {
    fn get(&self) -> Option<&T>;
    fn required(&self, field: &'static str) -> Result<&T, ClientError>;
    fn is_loaded(&self) -> bool;
}

impl<T> RelationExt<T> for Relation<T> {
    fn get(&self) -> Option<&T> {
        match self {
            Relation::Loaded(value) => Some(value),
            _ => None,
        }
    }

    fn required(&self, field: &'static str) -> Result<&T, ClientError> {
        match self {
            Relation::Loaded(value) => Ok(value),
            Relation::Null => Err(ClientError::NullRelation(field)),
            Relation::NotLoaded => Err(ClientError::RelationNotLoaded(field)),
        }
    }

    fn is_loaded(&self) -> bool {
        !matches!(self, Relation::NotLoaded)
    }
}
```

Usage:

```rust
let profile = user.profile.required("profile") ?;
let avatar = profile.avatar_url();
```

This produces better errors than `unwrap()` and makes relation state explicit.

### 7.2 Projection Types Can Avoid `Relation<T>`

For high-level application-facing projection types, you may not need to expose `Relation<T>`.

If the relation was not included, omit the field.

If the relation was included and optional, use:

```rust
pub profile: Option<Profile>
```

If the relation was included and required, use:

```rust
pub organization: Organization
```

This makes app-level code simpler.

---

## 8. Dart / Flutter Design

Dart should not directly mirror Rust's trait-heavy design. Instead, use Dart's idioms:

* `abstract interface class`
* extension methods
* projection-specific DTO classes
* nullable types with `?`
* non-nullable fields with defaults where appropriate

### 8.1 Projection-Specific Dart Classes

Generate different Dart classes for different query projections.

```dart
class UserBase {
  final String id;

  const UserBase({required this.id});
}

class UserCard implements HasId, HasName, HasAvatarUrl {
  @override
  final String id;

  @override
  final String name;

  @override
  final String? avatarUrl;

  const UserCard({
    required this.id,
    required this.name,
    this.avatarUrl,
  });
}

class UserDetails implements HasId, HasName, HasEmail {
  @override
  final String id;

  @override
  final String name;

  @override
  final String email;

  const UserDetails({
    required this.id,
    required this.name,
    required this.email,
  });
}
```

The important rule is the same as Rust:

> If a field was not selected, it should not exist on the generated Dart class.

### 8.2 Dart Interfaces as Trait Equivalents

Dart's closest equivalent to Rust traits is `abstract interface class`.

```dart
abstract interface class HasId {
  String get id;
}

abstract interface class HasName {
  String get name;
}

abstract interface class HasAvatarUrl {
  String? get avatarUrl;
}

abstract interface class HasProfile {
  Profile? get profile;
}

abstract interface class HasPosts {
  List<Post> get posts;
}
```

Generated classes implement only the interfaces that match their selected fields.

This works very well for Flutter widgets:

```dart
class UserCardTile<T extends HasName> extends StatelessWidget {
  final T user;

  const UserCardTile({
    super.key,
    required this.user,
  });

  @override
  Widget build(BuildContext context) {
    return Text(user.name);
  }
}
```

A widget that requires profile data can require `HasProfile`:

```dart
class UserProfileSection
<
T extends HasName & HasProfile> extends
StatelessWidget {

final T user;

const UserProfileSection
(
{super.key,
required this.user,
});

@override
Widget build(BuildContext context) {
final profile = user.profile;

if (profile == null) {
return Text('${user.name} has no profile');
}

return Text(profile.bio);
}
}
```

### 8.3 Dart Extension Methods

Use extensions to reduce nullable boilerplate.

```dart
extension NullableStringX on String? {
  String get orEmpty => this ?? '';

  String requiredField(String field) {
    final value = this;
    if (value == null) {
      throw StateError('Missing required field: $field');
    }
    return value;
  }
}
```

Usage:

```dart

final label = user.avatarUrl.orEmpty;
final bio = user.profile?.bio.requiredField('bio');
```

For lists:

```dart
extension NullableListX<T> on List<T>? {
  List<T> get orEmpty => this ?? const [];
}
```

But if you control the generated DTOs, prefer this:

```dart
final List<Post> posts;
```

instead of this:

```dart
final List<Post>? posts;
```

A list relation should usually be an empty list, not null.

### 8.4 Dart JSON Parsing

DTO constructors should apply safe defaults where the schema allows it.

```dart
class UserCard implements HasId, HasName, HasAvatarUrl {
  @override
  final String id;

  @override
  final String name;

  @override
  final String? avatarUrl;

  const UserCard({
    required this.id,
    required this.name,
    this.avatarUrl,
  });

  factory UserCard.fromJson(Map<String, dynamic> json) {
    return UserCard(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
    );
  }
}
```

This gives Flutter code a clean experience:

```dart
Text
(
user
.
name
)
```

instead of:

```dart
Text
(
user
.
name
??
'
'
)
```

---

## 9. TypeScript / React Native / Next.js Design

TypeScript should use structural types and projection-specific return types.

```ts
type HasId = {
    id: string
}

type HasName = {
    name: string
}

type HasAvatarUrl = {
    avatarUrl: string | null
}
```

Generated projection type:

```ts
type UserCard = HasId & HasName & {
    avatarUrl: string | null
}
```

A selected optional relation:

```ts
type UserWithProfile = HasId & HasName & {
    profile: Profile | null
}
```

A relation that was not selected should not appear on the type.

Avoid this:

```ts
type User = {
    id: string
    name?: string
    profile?: Profile | null
}
```

because `profile?: Profile | null` introduces multiple meanings:

* property missing,
* property present but null,
* property optional due to query shape,
* property optional due to schema nullability.

Prefer this:

```ts
type UserBase = {
    id: string
}

type UserWithProfile = {
    id: string
    name: string
    profile: Profile | null
}
```

---

## 10. Schema-Level Defaults

Many optional fields can be avoided by improving schema defaults.

Instead of nullable fields like:

```prisma
name String?
bio  String?
```

prefer required fields with defaults when the domain allows it:

```prisma
name String @default("")
bio  String @default("")
```

Then generated types can use:

```rust
pub name: String,
pub bio: String,
```

and:

```dart
final String name;
final String bio;
```

Use nullable fields only when absence is meaningful:

```text
middle_name: Option<String> / String?
deleted_at: Option<DateTime> / DateTime?
avatar_url: Option<String> / String?
profile: Option<Profile> / Profile?
```

Main rule:

> Nullable means semantically absent, not merely empty.

---

## 11. Recommended Generated Rust API Shape

An ergonomic Rust query might look like this:

```rust
let user = client.user()
.find_unique(id)
.select(user::card())
.exec()
.await?;

println!("{}", user.name());
```

Where `user::card()` generates or refers to:

```rust
pub struct UserCard {
    pub id: String,
    pub name: String,
    pub avatar_url: Option<String>,
}
```

And implements:

```rust
impl HasId for UserCard {
    type Id = String;

    fn id(&self) -> &Self::Id {
        &self.id
    }
}

impl HasName for UserCard {
    fn name(&self) -> &str {
        &self.name
    }
}
```

For a relation query:

```rust
let user = client.user()
.find_unique(id)
.include(user::with_profile())
.exec()
.await?;
```

Return:

```rust
pub struct UserWithProfile {
    pub id: String,
    pub name: String,
    pub profile: Option<Profile>,
}
```

The type implements:

```rust
impl HasProfile for UserWithProfile {
    fn profile(&self) -> Option<&Profile> {
        self.profile.as_ref()
    }
}
```

---

## 12. Recommended Generated Dart API Shape

Flutter usage should feel natural:

```dart

final user = await
db.user.findUnique
(
where: UserWhereUnique(id: id),
select: UserSelect.card(),
);

return Text(
user
.
name
);
```

Generated type:

```dart
class UserCard implements HasId, HasName, HasAvatarUrl {
  @override
  final String id;

  @override
  final String name;

  @override
  final String? avatarUrl;

  const UserCard({
    required this.id,
    required this.name,
    this.avatarUrl,
  });
}
```

Optional relations should be explicit only when selected:

```dart
class UserWithProfile implements HasId, HasName, HasProfile {
  @override
  final String id;

  @override
  final String name;

  @override
  final Profile? profile;

  const UserWithProfile({
    required this.id,
    required this.name,
    this.profile,
  });
}
```

A class that does not select `profile` should not implement `HasProfile` and should not contain a `profile` field.

---

## 13. Advanced Option: Loaded vs Not Loaded Relation State

If your runtime needs to distinguish loaded and not-loaded relations explicitly, define a relation state internally.

Rust:

```rust
pub enum Relation<T> {
    NotLoaded,
    Null,
    Loaded(T),
}
```

Dart:

```dart
sealed class Relation<T> {
  const Relation();
}

class NotLoaded<T> extends Relation<T> {
  const NotLoaded();
}

class Loaded<T> extends Relation<T> {
  final T value;

  const Loaded(this.value);
}

class NullRelation<T> extends Relation<T> {
  const NullRelation();
}
```

However, this should probably remain an advanced or internal API.

For normal Flutter, React Native, and Next.js app code, projection-specific DTOs are easier:

* omitted field = not selected,
* nullable field = selected but nullable,
* non-null field = selected and required.

---

## 14. Error Handling Strategy

Avoid hidden panics in innocent-looking accessors.

Bad:

```rust
fn profile(&self) -> &Profile {
    self.profile.as_ref().unwrap()
}
```

Better:

```rust
fn profile_required(&self) -> Result<&Profile, ClientError> {
    self.profile.as_ref().ok_or(ClientError::MissingField("profile"))
}
```

Or, if panic-style access is useful, make it explicit:

```rust
fn expect_profile(&self) -> &Profile {
    self.profile
        .as_ref()
        .expect("profile was selected but is null")
}
```

Suggested generated accessor naming:

```rust
user.profile_opt()       // Option<&Profile>
user.profile_required() ? // Result<&Profile, ClientError>
user.expect_profile()    // panics with clear message
```

Avoid naming a panic-prone method simply:

```rust
user.profile()
```

unless it cannot panic.

---

## 15. Practical Generation Strategy

The generator should produce:

### Rust

1. Raw model structs.
2. Projection-specific structs.
3. Field traits such as `HasId`, `HasName`, `HasEmail`.
4. Relation traits such as `HasProfile`, `HasPosts`.
5. Extension traits for `Option<T>`, `Option<String>`, and relation states.
6. Optional convenience getters.
7. Query builders whose return type is based on selected fields.

### Dart

1. Projection-specific DTO classes.
2. `abstract interface class` definitions for shared fields.
3. Extension methods for nullable convenience.
4. JSON serializers/deserializers.
5. Non-nullable fields wherever the schema guarantees them.
6. Nullable fields only for real selected nullable values.

### TypeScript

1. Projection-specific object types.
2. Shared structural interfaces/types.
3. `null` only for selected nullable fields.
4. Omitted properties only for fields that are not selected.

---

## 16. Final Recommendation

The best overall design is:

> Let the query shape drive the return type, and use traits/interfaces to share behavior across generated projection
> types.

For Rust:

* Use projection-specific structs.
* Use traits such as `HasName`, `HasProfile`, `HasPosts`.
* Use extension traits to make `Option<T>` less noisy.
* Use `Relation<T>` internally if you need to distinguish `NotLoaded`, `Null`, and `Loaded`.

For Dart:

* Use projection-specific DTO classes.
* Use `abstract interface class` as the trait equivalent.
* Use extension methods for nullable convenience.
* Keep app-facing DTOs simple and idiomatic.

For TypeScript:

* Use structural types.
* Avoid optional properties for selected fields.
* Use `null` only for actual schema nullability.

The guiding rule across all platforms is:

```text
If a field was not selected, it should not exist on the returned type.
If a field was selected and nullable, it should be nullable.
If a field was selected and required, it should be non-null.
If a value can safely default, default it at the schema or DTO boundary.
```

This gives you the best balance between Rust correctness and client-side ergonomics.
