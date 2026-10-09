# I. Overview

This document defines all **persistence / TypeORM** conventions (it merges the former
`database.md`). The chosen store is **TypeORM + PostgreSQL** — the closest NestJS equivalent of
the reference repo's EF Core + PostgreSQL. If the project later adopts Mongoose/MongoDB, the
same *principles* apply (one schema per file, snake_case storage names, UUID v7 ids, timestamps,
schema as single source of truth).

> Persistence choice mirrors the reference repo: a relational store with UUID primary keys and
> `timestamptz` timestamps. See `docs/requirement.md` for why PostgreSQL fits the
> aggregation-heavy workout/PR queries.

# II. Convention

## 1. Entity classes (`src/.../<feature>/entities/`)

- Plain, behavior-light classes decorated with TypeORM decorators. Keep query logic out of
  entities — it belongs in repositories/services.
- Every entity class name **must** be suffixed with `Entity`. The convention is `<Name>Entity`,
  for example: `UserEntity`, `InvitationEntity`, `WorkoutEntryEntity`.
- **One entity per file**, file named `{entity-name}.entity.ts`, class named `{EntityName}Entity`.
  For example `workout-entry.entity.ts` → `WorkoutEntryEntity`. The class name must match the
  file name.
- Each entity must be decorated with `@Entity({ name: '<snake_case_plural>' })`.
- `id: string` (UUID v7) for every primary key.
- `createdTime: Date` (required) and `updatedTime?: Date` for timestamps, stored as
  `timestamptz`.
- Relations: collections initialized as `[]`; single references typed `T | null`.
- Every entity implements one of the shared entity contracts (`src/common/entities/`),
  **one interface per file**:
  - `IImmutableEntity` — `readonly id: string`, `readonly createdTime: Date`.
  - `IMutableEntity` — extends `IImmutableEntity` and adds an optional read/write
    `updatedTime: Date | undefined`.
- **Mutable entities** (records that can be updated after creation) **must implement
  `IMutableEntity`**.
- **Immutable entities** (append-only / log-style records that are only ever inserted)
  **must implement `IImmutableEntity`**.
- There is no shared base class to extend — implement the interface and declare the
  `id` / `createdTime` / `updatedTime` columns on the entity itself.

```ts
// src/users/entities/user.entity.ts — mutable
import { Column, Entity, PrimaryColumn } from 'typeorm';
import { IMutableEntity } from '../../common/entities/mutable-entity.interface';

@Entity({ name: 'users' })
export class UserEntity implements IMutableEntity {
  //#region Properties
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  public readonly id: string;

  @Column({ name: 'created_time', type: 'timestamptz' })
  public readonly createdTime: Date;

  @Column({ name: 'updated_time', type: 'timestamptz', nullable: true })
  public updatedTime?: Date;
  //#endregion

  //#region Constructor
  public constructor(id: string, createdTime: Date) {
    this.id = id;
    this.createdTime = createdTime;
  }
  //#endregion
}
```

```ts
// src/workouts/entities/workout-set.entity.ts — immutable (append-only)
import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { IImmutableEntity } from '../../common/entities/immutable-entity.interface';
import { WorkoutEntryEntity } from './workout-entry.entity';

@Entity({ name: 'workout_sets' })
export class WorkoutSetEntity implements IImmutableEntity {
  //#region Properties
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  public readonly id: string;

  @Column({ name: 'created_time', type: 'timestamptz' })
  public readonly createdTime: Date;

  @ManyToOne(() => WorkoutEntryEntity, (entry) => entry.sets)
  public workoutEntry!: WorkoutEntryEntity;
  //#endregion

  //#region Constructor
  public constructor(id: string, createdTime: Date) {
    this.id = id;
    this.createdTime = createdTime;
  }
  //#endregion
}
```

## 2. Entity configuration / mapping

- EF `IEntityTypeConfiguration<T>` maps to TypeORM's decorator metadata plus an optional
  `EntitySchema`. Keep all column-name / index / constraint mapping **in the entity file**
  (or a sibling `{entity-name}.schema.ts` if using `EntitySchema`), one per file.
- Entities are auto-discovered by the data-source `entities` glob — the equivalent of EF's
  `ApplyConfigurationsFromAssembly`. Register them via the glob, not one-by-one, unless a
  curated explicit list is required; when listing explicitly, keep the list order the same as
  the file order in the `entities/` folder.

## 3. Database naming conventions

| Element      | Convention             | Example                                        |
| ------------ | ---------------------- | ---------------------------------------------- |
| Table name   | `snake_case` (plural)  | `workout_entries`                              |
| Column name  | `snake_case`           | `created_time`                                 |
| Primary key  | `pk_{table}`           | `pk_workout_entries`                           |
| Foreign key  | `fk_{table}_{column}`  | `fk_workout_sets_workout_entry_id`             |
| Unique index | `uq_{table}_{columns}` | `uq_workout_entries_user_id_exercise_name_date`|
| Index        | `ix_{table}_{columns}` | `ix_workout_entries_user_id_date`              |

- Use explicit constraint/index names (`@Index('ix_...', [...])`, `@Unique('uq_...', [...])`)
  rather than letting the ORM auto-generate them — matches the reference's named-constraint rule.

## 4. Migrations

- Any database change (new entity, new/changed/removed column, index, constraint, relation, …)
  **must** be captured in a TypeORM migration. Never rely on `synchronize: true` outside local
  development.
- Migrations are generated with the **TypeORM CLI** and every migration must implement both
  `up()` (apply) and `down()` (revert). A migration without a working `down()` is not acceptable.
- Workflow:
  1. Change the entity/schema.
  2. Generate the migration from the diff:
     ```bash
     npx typeorm migration:generate ./src/migrations/<ChangeName> -d ./src/data-source.ts
     ```
  3. Review the generated `up()` / `down()` — confirm the `down()` cleanly reverses the `up()` —
     and adjust names to the naming conventions above.
  4. Apply with `npx typeorm migration:run -d ./src/data-source.ts`; revert with
     `npx typeorm migration:revert -d ./src/data-source.ts`.
- Migration files live in `src/migrations/` and keep the CLI-generated
  `{timestamp}-{ChangeName}.ts` naming so run order is deterministic.

## 5. Schema as single source of truth

- The logical schema is documented in `docs/schema.md` (or a DBML file under `docs/`). Entity
  classes and migrations must match it.
- If an entity changes, update the schema doc **and** add a migration in the same change.
- Timestamps are stored in UTC (`timestamptz`); conversion to the caller's timezone happens at
  the API boundary, never in storage. Document any timezone trade-offs in the README.
