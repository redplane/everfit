# I. Overview

The NestJS / TypeScript project must follow the following coding convention. These
conventions are adapted from the reference .NET conventions and translated to their
idiomatic TypeScript / NestJS equivalents.

# II. Convention

## 1. General

- **Runtime / language:** Node.js 22 LTS, TypeScript 5+ (`strict` mode enabled).
- **Module system:** ES modules / NestJS modules. One Nest feature per module.
- **`strictNullChecks`:** enabled. Prefer `T | undefined` / `T | null` explicitly over
  implicit any.
- **Explicit access modifiers.** Every class member (property, constructor, method,
  accessor) must declare an explicit access modifier — `public`, `protected`, or `private`.
  **DO NOT** rely on the implicit-`public` default. Order modifiers as
  `<access> [static] [readonly]`, e.g. `public readonly id: string`,
  `private static readonly cache: Map<string, number>`.
- **Naming**
  - `PascalCase` for classes, interfaces, enums (the type name), decorators, type aliases.
  - `camelCase` for methods, properties, variables, function parameters.
  - **Member visibility prefix.** A **private** property or method name must be prefixed with
    `__` (double underscore); a **protected** property or method name must be prefixed with `_`
    (single underscore). `public` members take no prefix. For example: `private readonly __joiService`,
    `private __recalculateAsync()`, `protected _cache`, `protected _onInitAsync()`,
    `public readonly id`.
  - `SNAKE_UPPER_CASE` for **enum members / constant-group members**. For example:
    `UserStatuses.ACTIVE`, `WeightUnits.KILOGRAM`, `ItemStatuses.OUT_OF_STOCK`.
  - File names use `kebab-case` with a role suffix (NestJS style):
    `workout-entry.entity.ts`, `create-workout.dto.ts`, `workouts.controller.ts`,
    `workouts.service.ts`, `log-workout.command.ts`.
- **No data annotations for persistence shape on plain domain objects** — keep ORM mapping
  in dedicated entity/schema definitions (see `../orms/typeorm.md`), not scattered across DTOs.
- **UUID:** always generate UUID v7 (e.g. `uuidv7()` from the `uuidv7` package). **DO NOT**
  use `uuid.v4()` / `Math.random()` for identifiers. v7 is time-ordered, which keeps primary
  keys index-friendly — the same intent as `Guid.CreateVersion7()` in the reference.
- **One declaration per file.** One class, interface, or enum per file. **DO NOT** place
  multiple classes/interfaces/enums in a single file. (Barrel `index.ts` files that only
  re-export are allowed.)
- **File-local organization.** Within a class or interface, members must be grouped into
  `#region` comment banners, in this order:
  1. Properties (regardless of modifier) → `//#region Properties`
  2. Constructor → `//#region Constructor`
  3. Public methods → `//#region Methods`
  4. Protected / private methods → `///#region Internal methods`

  Each region is closed with its matching `#endregion`. Example:

```ts
export class WorkoutEntryEntity {
  //#region Properties
  public userId: string;
  public exerciseName: string;
  //#endregion

  //#region Constructor
  public constructor(id: string, createdTime: Date) {
    this.id = id;
    this.createdTime = createdTime;
  }
  //#endregion

  //#region Methods
  public addSetAsync(): Promise<void> {
    return this.recalculateAsync();
  }
  //#endregion

  ///#region Internal methods
  private recalculateAsync(): Promise<void> {
    // ...
  }
  //#endregion
}
```

- **`readonly` properties must be initialized in the constructor**, and the constructor must
  declare them as parameters. For example:

```ts
public constructor(id: string, createdTime: Date) {
  this.id = id;
  this.createdTime = createdTime;
}
```

## 2. Classes, interfaces, methods, properties

- A method that returns a `Promise` **or** an `Observable` must have the `Async` suffix in its
  name. For example: `getUserAsync()`, `getAsync()`, `createAsync()`, `logWorkoutAsync()`.
- **Do not repeat the entity name in a method name when the class already is about that entity.**
  If a class is scoped to an entity (e.g. `User`, `UserService`), its methods must **not** restate
  the entity — the class already provides that context. Use `getByIdAsync(...)` / `getById()` /
  `createAsync(...)` / `deleteByIdAsync(id)`, **not** `getUserByIdAsync(...)` /
  `deleteUserByIdAsync(...)`. For example, in `UserService`:

```ts
@Injectable()
export class UserService implements IUserService {
  //#region Methods
  public getById(id: string): string {
    // ...
  }

  public getByIdAsync(id: string): Promise<UserEntity> {
    // ...
  }

  public deleteByIdAsync(id: string): Promise<void> {
    // ...
  }
  //#endregion
}
```
- **DO NOT** put business logic in a constructor. Constructors are for dependency injection
  only (NestJS injects providers through the constructor). Example:

```ts
@Injectable()
export class WorkoutService {
  public constructor(
    private readonly workoutRepository: WorkoutRepository,
    private readonly dateTimeContext: DateTimeContext,
  ) {}
}
```

- Group of constants must be declared as an `enum` (or `const` object) whose name is a
  **plural noun**, with members in `SNAKE_UPPER_CASE`. For example: `WeightUnits`,
  `WorkoutStatuses`, `ItemStatuses`. Either form is acceptable:

```ts
export enum WeightUnits {
  KILOGRAM = 'KILOGRAM',
  POUND = 'POUND',
}

// or, as a const object with a derived union type:
export const ItemStatuses = {
  ACTIVE: 'ACTIVE',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
} as const;

export type ItemStatus = (typeof ItemStatuses)[keyof typeof ItemStatuses];
```

  Usage reads as `WeightUnits.KILOGRAM`, `ItemStatuses.ACTIVE`.

- **Enums**
  - An enum name must be a **plural noun**. For example: `UserStatuses`, `InvitationStatuses`,
    `WeightUnits`.
  - Enum member (property) names must be `SNAKE_UPPER_CASE`. For example:
    `UserStatuses.PENDING_INVITATION`, `InvitationStatuses.ACCEPTED`.
  - Enum **values** must also be `SNAKE_UPPER_CASE` (matching their member name). For example:
    `PENDING_INVITATION = 'PENDING_INVITATION'`.

```ts
export enum UserStatuses {
  PENDING_INVITATION = 'PENDING_INVITATION',
  ACTIVE = 'ACTIVE',
  DEACTIVATED = 'DEACTIVATED',
}
```

- Prefer `interface` for pure shapes/contracts and `class` for anything with behavior or
  that participates in DI.
- An interface that describes a service contract is named `I<ServiceName>` only when a
  separate token is needed; otherwise the concrete `class` is the injection token
  (idiomatic NestJS). See `../nestjs/api.md` → Services.
