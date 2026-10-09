# I. Overview

This document defines the **order of steps** every API request goes through inside a controller
handler. The flow is strict: each stage runs only after the previous one has passed, so cheap /
generic checks fail fast before any domain logic or database access happens.

```
Controller
  → Validate request            (shape & types — Joi)
  → Generic back-end checks      (cross-cutting infra concerns — generic services)
  → Domain business checks       (domain rules — domain services / factories)
  → Interact with the database   (reads/writes — data-access services)
```

Controllers stay **thin**: they orchestrate these stages by delegating to services. No business
logic and no direct database access live in the controller itself.

# II. The stages

## 1. Controller

- The controller handler receives the request, maps inputs into DTOs (`XxxPayloadDto`,
  `XxxQueryDto`, `XxxParamDto` — see `api.md`), and drives the stages below in order.
- It injects the services it needs via the constructor and calls them; it does not implement the
  checks itself.

## 2. Validate request

- Validate every mapped DTO with its **Joi** schema via the injected `JoiService` at the very
  start of the handler. Use the returned (validated + coerced) instance downstream.
- This stage only covers **shape and types** (required fields, formats, ranges, enums). See
  `request-validation.md`.
- On failure a `ValidationException` propagates to the filter → `400`. Nothing past this point
  runs.

## 3. Generic back-end checks

- Next, run **generic / cross-cutting back-end checks** — concerns that are *not* specific to the
  domain entity. Examples: validating a reCAPTCHA token, checking an uploaded image's size /
  dimensions / mime type, rate-limit or quota checks, verifying a signed URL, etc.
- These are implemented by **generic services** (the "services" providers defined in the `api`
  project, e.g. a captcha service, an image/thumbnail service). The controller injects and calls
  them.
- Keep these checks reusable across modules — they must not encode rules about a particular
  domain entity.
- On failure, throw the appropriate exception (e.g. `InvalidCaptchaException`,
  `InvalidImageException`) which the exception filter maps to an HTTP error.

## 4. Domain business checks

- Then run **domain business checks** — rules specific to the feature/entity. Examples: "this
  exercise exists", "the user belongs to this coach", "the unit is supported", "no conflicting
  record for the same (user, exercise, timestamp)".
- These go through **domain services or factories**, not inline controller code. A factory is used
  when constructing a valid domain object requires invariants to be enforced; a domain service is
  used for checks/operations that span repositories or need other services.
- Dependencies that must exist are fetched and verified here; if missing, throw
  `<Entity>ByIdNotFoundException` / `<Entity>ByCodeNotFoundException` (see `api.md` §3.6).

## 5. Interact with the database

- Only after all checks pass does the handler **read from or write to the database**, and only
  **through a data-access service** (`getByIdAsync`, `createAsync`, `updateByIdAsync`,
  `deleteByIdAsync`; writes take `Create<Entity>Options` / `Update<Entity>Options`). See
  `api.md` §3.5.
- The controller never touches the ORM / repository directly.
- The resulting entity is mapped to a response DTO and returned.

# III. Example (shape)

```ts
@Post()
@HttpCode(HttpStatus.OK)
public async createAsync(@Body() payload: CreateWorkoutPayloadDto): Promise<WorkoutEntryDto> {
  // 2. Validate request (shape & types)
  const instance = await this.__joiService.validateAsync(payload, createWorkoutPayloadJoiSchema);

  // 3. Generic back-end checks (cross-cutting infra) — e.g. captcha, upload limits
  await this.__captchaService.validateAsync({ token: instance.captchaToken });

  // 4. Domain business checks (domain services / factories)
  await this.__exerciseService.ensureExistsAsync(instance.exerciseName);
  const workout = this.__workoutFactory.create(instance); // enforces domain invariants

  // 5. Interact with the database (data-access service)
  const created = await this.__workoutService.createAsync(workout);

  return WorkoutEntryDto.fromEntity(created);
}
```

- Stages 3 and 4 are skipped when a given endpoint has nothing to check at that level, but the
  **order** is never reordered: validation → generic checks → domain checks → database.
