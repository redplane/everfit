# I. Overview

Request validation uses **Joi** — not the NestJS / `class-validator` annotations (see
`api.md` §3.3). Every request DTO has a matching Joi schema, and a single injectable
`JoiService` validates the incoming object against that schema inside the controller. Joi
validation failures are translated into a structured `400` response by a global exception filter.

This keeps validation:

- **Explicit** — the controller calls `validateAsync(input, schema)`; nothing is validated by
  hidden decorator magic.
- **Typed** — a schema is declared as `Joi.object<TDto>(...)`, so it stays in sync with its DTO.
- **Coercing** — `convert: true` turns query-string strings into numbers/dates/booleans, which is
  what query DTOs need.

# II. Convention

## 1. The Joi service

- A shared, injectable `JoiService` implements `IJoiService`:

```ts
// src/common/services/joi/joi-service.interface.ts
import Joi from 'joi';

export interface IJoiService {
  //#region Methods
  validateAsync<T>(instance: T, schema: Joi.Schema<T>): Promise<T>;
  //#endregion
}
```

```ts
// src/common/services/joi/joi.service.ts
import { Injectable } from '@nestjs/common';
import Joi from 'joi';
import { IJoiService } from './joi-service.interface';
import { ValidationException } from '../../exceptions/validation.exception';
import { ValidationIssue } from '../../models/validation-issue';

@Injectable()
export class JoiService implements IJoiService {
  //#region Methods
  public async validateAsync<T>(instance: T, schema: Joi.Schema<T>): Promise<T> {
    try {
      return await schema.validateAsync(instance, { convert: true });
    } catch (exception: unknown) {
      const error = exception as Record<string, unknown>;
      if (error['details'] instanceof Array) {
        const issues = error['details'].map((detail) => new ValidationIssue(detail.message));
        throw new ValidationException(issues);
      }
      throw exception;
    }
  }
  //#endregion
}
```

- `JoiService` is registered under an injection token and exported from a provider module so any
  feature module can import it (register via `{ provide: InjectionTokens.SERVICE__JOI, useClass:
  JoiService }`). It is the **only** place that calls `schema.validateAsync`.
- `validateAsync` returns the **validated, coerced** instance — always use the returned value
  downstream, not the raw input.

## 2. Writing schemas

- One Joi schema **per DTO**, co-located with the DTO in the module's `dto/` folder (see
  `api.md`). File name mirrors the DTO with a `.joi-schema.ts` suffix:

  | DTO file                        | Schema file                            | Exported const                    |
  | ------------------------------- | -------------------------------------- | --------------------------------- |
  | `create-workout-payload.dto.ts` | `create-workout-payload.joi-schema.ts` | `createWorkoutPayloadJoiSchema`   |
  | `get-workouts-query.dto.ts`     | `get-workouts-query.joi-schema.ts`     | `getWorkoutsQueryJoiSchema`       |
  | `delete-workout-param.dto.ts`   | `delete-workout-param.joi-schema.ts`   | `deleteWorkoutParamJoiSchema`     |

- The exported constant is `camelCase` ending in `JoiSchema`, and the schema is typed to its DTO:

```ts
// src/modules/workout/dto/create-workout-payload.joi-schema.ts
import Joi from 'joi';
import { CreateWorkoutPayloadDto } from './create-workout-payload.dto';

export const createWorkoutPayloadJoiSchema = Joi.object<CreateWorkoutPayloadDto>({
  userId: Joi.string().uuid().required(),
  date: Joi.string().isoDate().required(),
  exerciseName: Joi.string().trim().required(),
  sets: Joi.array()
    .items(
      Joi.object({
        reps: Joi.number().integer().positive().required(),
        weight: Joi.number().positive().required(),
        unit: Joi.string().valid('kg', 'lb').required(),
      }),
    )
    .min(1)
    .required(),
});
```

- **Reusable field schemas (required).** Any field rule that is used in more than one place —
  ids, usernames, pagers, enums, units, etc. — **must** be extracted into its own separate
  `*.joi-schema.ts` file and re-used, never re-declared inline. Each reusable schema is one file
  exporting one `camelCase` `xxxJoiSchema` constant. For example: `userIdJoiSchema`,
  `usernameJoiSchema`, `exerciseNameJoiSchema`, `pagerJoiSchema`.

```ts
// src/common/schemas/user-id.joi-schema.ts
import Joi from 'joi';

export const userIdJoiSchema = Joi.string().uuid();
```

```ts
// src/common/schemas/username.joi-schema.ts
import Joi from 'joi';

export const usernameJoiSchema = Joi.string().trim().min(1);
```

```ts
// src/common/schemas/pager.joi-schema.ts
import Joi from 'joi';

export const pagerJoiSchema = Joi.object({
  cursor: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
```

- Compose DTO schemas from these shared pieces instead of repeating constraints:

```ts
import Joi from 'joi';
import { userIdJoiSchema } from '../../../common/schemas/user-id.joi-schema';
import { pagerJoiSchema } from '../../../common/schemas/pager.joi-schema';

export const getWorkoutsQueryJoiSchema = Joi.object<GetWorkoutsQueryDto>({
  userId: userIdJoiSchema.required(),
  pager: pagerJoiSchema.optional(),
});
```

- Keep Joi constraints (max lengths, allowed values) sourced from shared constant groups where
  one exists (e.g. `WeightUnits`, entity constraint constants) rather than hard-coded literals.

## 3. Using schemas in controllers

- Inject `IJoiService` and validate each mapped input at the **start** of the handler; use the
  returned instance for the rest of the method.

```ts
@Controller({ path: 'api/workout' })
export class WorkoutApiController {
  //#region Constructor
  public constructor(
    @Inject(InjectionTokens.SERVICE__JOI)
    private readonly __joiService: IJoiService,
    @Inject(InjectionTokens.SERVICE__WORKOUT)
    private readonly __workoutService: IWorkoutService,
  ) {}
  //#endregion

  //#region Methods
  @Post()
  @HttpCode(HttpStatus.OK)
  public async createAsync(@Body() payload: CreateWorkoutPayloadDto): Promise<WorkoutEntryDto> {
    const instance = await this.__joiService.validateAsync(
      payload,
      createWorkoutPayloadJoiSchema,
    );

    // ... use `instance` (validated + coerced) from here on
    return this.__workoutService.createAsync(instance);
  }
  //#endregion
}
```

- If a handler takes more than one input (e.g. a param **and** a payload), validate each against
  its own schema.
- Do **not** `try/catch` the validation — let `ValidationException` propagate to the filter.

## 4. Error handling

- A Joi failure becomes a `ValidationException` carrying `ValidationIssue[]` (each is just a
  `message`). These are plain models under `src/common/`:

```ts
// src/common/models/validation-issue.ts
export class ValidationIssue {
  //#region Constructor
  public constructor(public readonly message: string) {}
  //#endregion
}
```

```ts
// src/common/exceptions/validation.exception.ts
import { ValidationIssue } from '../models/validation-issue';

export class ValidationException {
  //#region Constructor
  public constructor(public readonly issues: ValidationIssue[]) {}
  //#endregion
}
```

- A global filter maps `ValidationException` → HTTP `400` with a stable, structured body:

```ts
// src/common/filters/validation-exception.filter.ts
@Catch(ValidationException)
export class ValidationExceptionFilter implements ExceptionFilter {
  //#region Methods
  public catch(exception: ValidationException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(HttpStatus.BAD_REQUEST).json({
      code: BusinessExceptionCodes.VALIDATION_ISSUE,
      issues: exception.issues,
    });
  }
  //#endregion
}
```

- `ValidationExceptionFilter` is registered alongside the business and unhandled filters via
  `APP_FILTER` — see **[error-handling.md](./error-handling.md)** §1 (this exception) and §4 (filter
  registration + ordering). Validation errors return `400` with `{ code, issues: [{ message }] }`;
  other domain errors are handled by the `BusinessException` filter (`api.md` §3.6).
