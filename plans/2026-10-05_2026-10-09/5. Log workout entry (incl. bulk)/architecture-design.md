# Architecture Design — Task 5: Log a workout entry (including bulk)

- **Task:** `5. Log workout entry (incl. bulk)` — Feature **F5**.
- **Depends on:** Task 2 (user), Task 3 (exercise/muscle-group), Task 4 (unit registry).
- **Goal:** Log a workout — one or many exercises, each with its sets — as row-per-set records in a
  single atomic transaction, normalizing weights to kg and rejecting true duplicate sets with 409.

See `architecture.md` §2.5–2.8, §3, §8.

## Database changes

- **`workout_entries`** → `WorkoutEntryEntity` (immutable, `IImmutableEntity`): `id` (uuid PK v7
  `pk_workout_entries`), `user_id` (FK `fk_workout_entries_user_id`), `exercise_id` (FK
  `fk_workout_entries_exercise_id`), `performed_at` (`timestamptz`, UTC), `created_time`.
- **`workout_sets`** → `WorkoutSetEntity` (immutable): `id` (uuid PK v7 `pk_workout_sets`),
  `workout_entry_id` (FK `fk_workout_sets_workout_entry_id`), `user_id`, `exercise_id`,
  `performed_at` (`timestamptz`, denormalized), `set_number` (`smallint`), `reps` (`integer`),
  `weight` (`numeric(7,3)`), `unit` (`varchar(8)` — wire code), `weight_kg` (`numeric(9,4)`),
  `created_time`.
- **Constraints / indexes** (migration `src/migrations/<ts>-CreateWorkoutTables.ts`):
  - Unique `uq_workout_sets_user_id_exercise_id_performed_at_set_number` on
    `(user_id, exercise_id, performed_at, set_number)` — duplicate rejection (Q8).
  - `ix_workout_entries_user_id_performed_at_id` `(user_id, performed_at DESC, id DESC)` (F6 keyset).
  - `ix_workout_entries_user_id_exercise_id_performed_at` `(user_id, exercise_id, performed_at DESC)`.
  - `ix_workout_sets_user_id_exercise_id_weight_kg` `(user_id, exercise_id, weight_kg DESC)` (F7).
  - `ix_workout_sets_user_id_exercise_id_volume` `(user_id, exercise_id, ((reps*weight_kg)) DESC)` (F7).
  - `ix_workout_sets_user_id_exercise_id_epley`
    `(user_id, exercise_id, ((weight_kg*(1+reps/30.0))) DESC)` (F7).
  - `ix_workout_sets_user_id_exercise_id_performed_at` `(user_id, exercise_id, performed_at DESC)` (F8).
  - `down()` drops both tables + all constraints/indexes.
  - The three expression indexes may need raw SQL in the migration (TypeORM entity decorators cannot
    express computed-expression indexes); declare them in the migration explicitly and note it.

## API changes

- **`POST /api/workout`** (`@ApiTags('Workouts')`, `@ApiOperation({ summary: 'Log a workout' })`).
  New. Returns **201**.
  - Body DTO `CreateWorkoutPayloadDto` (`create-workout-payload.dto.ts`): a bulk-capable shape —
    `userId` (uuid, required) and `entries: WorkoutEntryPayload[]` (min 1), each entry:
    `exerciseId` (uuid, required), `performedAt` (ISO date-time string, required — stored UTC),
    `sets: WorkoutSetPayload[]` (min 1), each set: `reps` (int, positive), `weight` (number,
    positive), `unit` (via `weightUnitJoiSchema`). A single-exercise log is just `entries.length === 1`.
    - `set_number` is assigned **server-side** per entry by array order (1-based) — not client input,
      so two identical sets in the array are distinct repeats (accepted), while re-submitting the same
      batch collides on the unique key (409).
  - Joi schema `create-workout-payload.joi-schema.ts` composing `userIdJoiSchema`,
    `weightUnitJoiSchema`; `performedAt` = `Joi.string().isoDate().required()`; `reps`
    `Joi.number().integer().positive().required()`; `weight` `Joi.number().positive().required()`;
    `sets`/`entries` `.min(1).required()`.
  - 201 → `LogWorkoutResultDto` = `{ entries: LoggedWorkoutEntryDto[] }`, each
    `{ id, exerciseId, performedAt, sets: LoggedWorkoutSetDto[] }`,
    set = `{ id, setNumber, reps, weight, unit, weightKg }`.
  - Errors:
    - 400 `VALIDATION_ISSUE` — shape errors (null/missing date, ≤0 weight/reps, empty sets/entries,
      bad unit).
    - 404 `USER_NOT_FOUND` (`UserByIdNotFoundException`) — unknown user (whole request rejected).
    - 404 `EXERCISE_NOT_FOUND` (`ExerciseByIdNotFoundException`) — any unknown exercise (whole
      request rejected / rolled back).
    - 409 `WORKOUT_ALREADY_EXISTS` (`WorkoutSetAlreadyExistsException`) — duplicate set; within a
      bulk request the whole batch rolls back.

## Environment variables

None.

## Contract

- Core `workout` module `src/modules/cores/workout/`:
  - `entities/workout-entry.entity.ts`, `entities/workout-set.entity.ts`.
  - `services/workout/workout-service.interface.ts` → `IWorkoutService` (data access):
    `createManyAsync(options: CreateWorkoutOptions): Promise<WorkoutEntryEntity[]>` — wraps the whole
    batch in **one** transaction (§8); on `23505` translates to `WorkoutSetAlreadyExistsException`.
    (History/PR methods are added in Tasks 6/7 on the same interface.)
  - `exceptions/workout-set-already-exists.exception.ts` → `WorkoutSetAlreadyExistsException extends
    BusinessException` (`WORKOUT_ALREADY_EXISTS`, 409).
  - `workout-injection-tokens.ts` (`SERVICE__WORKOUT`), `workout.service.module.ts`,
    `workout.module.ts` (`forFeature` both entities; exports `SERVICE__WORKOUT`).
- `CreateWorkoutOptions` (`src/models/options/create-workout-options.ts`): `userId`, and per-entry
  `exerciseId`, `performedAt: Date`, `sets: { setNumber, reps, weight, unit, weightKg }[]`.
- API `workout` module `src/modules/apis/workout/`:
  - `services/workout-logging/workout-logging-service.interface.ts` → `IWorkoutLoggingService.logAsync`
    orchestrating: validate user exists (`IUserService`), validate every exercise exists
    (`IExerciseService`), normalize each set via `IScaleUnitConversionService.toBaseAsync`
    (weight → kg), assign `set_number`, call `IWorkoutService.createManyAsync`. Token
    `SERVICE__WORKOUT_LOGGING`.
  - `workout-api.module.ts`, `workout-api.controller.ts` (`createAsync`), `dto/` + schemas.

## Tests to define (in-memory DB)

- `src/modules/cores/workout/services/workout/workout.service.spec.ts`: `describe('createManyAsync')`
  — single entry persists row-per-set with correct `set_number`/`weight_kg`; bulk multi-exercise
  persists in one transaction; two identical sets both persist (distinct `set_number`); a true
  duplicate throws `WorkoutSetAlreadyExistsException`; a failure mid-batch rolls back **everything**
  (assert nothing written).
- `src/modules/apis/workout/services/workout-logging/workout-logging.service.spec.ts`:
  `describe('logAsync')` — happy path; unknown user → `UserByIdNotFoundException`; unknown exercise →
  `ExerciseByIdNotFoundException`; unsupported unit path; verifies `toBaseAsync` is applied; bulk
  rollback on any failure.
- `src/modules/apis/workout/workout-api.controller.spec.ts`: `describe('createAsync')` — validates
  payload, returns 201 `LogWorkoutResultDto`, propagates each exception type.

## Existing tests that must change

- **None.** → **ready**.

## Files to create/change

Core `workout/` tree + migration; api `workout/` tree; `create-workout-options.ts`. Change: register
`WorkoutApiModule` in `app.module.ts`.

## Done when

`pnpm nx test api` passes (incl. rollback + duplicate branches); `pnpm nx build api` succeeds;
migration up/down verified; bulk is atomic; duplicate set → 409; legitimate repeat accepted;
conventions met.
