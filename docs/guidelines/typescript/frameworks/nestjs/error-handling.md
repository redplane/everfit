# I. Overview

Errors are **never** translated to HTTP responses with `try/catch` inside controllers or services.
Instead, code **throws typed exceptions** and a small set of **global exception filters** (registered
via `APP_FILTER`) map each exception type to a stable, structured response body. This keeps the HTTP
layer thin (see [api.md](./api.md) §3.6) and the error contract consistent across every endpoint.

There are **three** error categories, each with its own exception type, its own filter, and its own
response shape:

| Category                         | Thrown as              | Filter                      | HTTP status                 | Body |
| -------------------------------- | ---------------------- | --------------------------- | --------------------------- | ---- |
| **1. Request parameter validation** | `ValidationException`  | `ValidationExceptionFilter` | always `400`                | `{ code, issues: [{ message }] }` |
| **2. Business logic validation**    | `BusinessException`    | `BusinessExceptionFilter`   | declared by the exception   | `{ code, message }` |
| **3. Unhandled / unexpected**       | anything else          | `UnhandledExceptionFilter`  | always `500`                | `{ code, message }` (safe, generic) |

All three bodies share a `code` discriminator (a stable, machine-readable string — **not** the numeric
HTTP status), so clients branch on `code`, never on a free-text message.

# II. Convention

## 1. Request parameter validation exception

This is the input-boundary failure: the request body / query / route params do not satisfy their Joi
schema. The full Joi mechanism (schemas, `JoiService`, where to call `validateAsync`) is documented in
[request-validation.md](./request-validation.md); this section only covers the **exception and its
filter**.

- A Joi failure is converted by `JoiService` into a `ValidationException` carrying a list of
  `ValidationIssue` (each is just a human-readable `message`). `ValidationException` is a **plain
  model**, deliberately **not** an `HttpException` — so it cannot accidentally be caught by the
  business filter, and always flows to its own dedicated filter.

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

- Controllers **may also throw `ValidationException` directly** for cross-field / semantic request
  errors that a single-field Joi rule cannot express (e.g. "`endDate` must be after `startDate`", or
  "`scopeId` is required when `scope` is `TENANT`"). This keeps all *request-shape* errors on the same
  `400` path:

```ts
if (payload.scope === WorkoutScopes.Shared && !payload.sharedWithUserId) {
  throw new ValidationException([
    new ValidationIssue('"sharedWithUserId" is required when "scope" is SHARED'),
  ]);
}
```

- The filter maps it to `400` with a fixed `code` plus the issues array:

```ts
// src/common/filters/validation-exception.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ValidationException } from '../exceptions/validation.exception';
import { BusinessExceptionCodes } from '../constants/business-exception-codes';

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

- **Resulting response** — HTTP `400`:

```json
{ "code": "VALIDATION_ISSUE", "issues": [{ "message": "\"userId\" is required" }] }
```

## 2. Business logic validation exception

This is the domain-rule failure: the request was well-formed, but a business invariant was violated
(entity not found, duplicate, insufficient permission, disabled account, …). These are raised **in the
service layer** (and occasionally in a controller after a generic back-end check — see
[request-flow.md](./request-flow.md)).

### 2.1. The base exception

- All domain exceptions extend a single `BusinessException` that extends NestJS `HttpException`. It
  adds a stable string `code` on top of the message and HTTP status:

```ts
// src/common/exceptions/business.exception.ts
import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  //#region Constructor
  public constructor(
    public readonly code: string,
    public override readonly message: string,
    status: HttpStatus | number = HttpStatus.BAD_REQUEST,
  ) {
    super(message, status);
  }
  //#endregion
}
```

### 2.2. Error codes

- Stable `code` values live in **one** enum so they are discoverable and cannot drift. Clients branch
  on these; they must never change once shipped:

```ts
// src/common/constants/business-exception-codes.ts
export enum BusinessExceptionCodes {
  VALIDATION_ISSUE = 'VALIDATION_ISSUE',
  UNHANDLED = 'UNHANDLED',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  WORKOUT_NOT_FOUND = 'WORKOUT_NOT_FOUND',
  WORKOUT_ALREADY_EXISTS = 'WORKOUT_ALREADY_EXISTS',
  NOT_ENOUGH_PERMISSION = 'NOT_ENOUGH_PERMISSION',
}
```

### 2.3. One class per error

- Every distinct domain error is its **own `BusinessException` subclass**, hard-coding its `code`,
  message, and HTTP status in the constructor. Call sites then `throw new XxxException(...)` with no
  knowledge of status codes or wire format. Messages are parameterized where it helps the caller:

```ts
// src/modules/apis/workout/exceptions/workout-by-id-not-found.exception.ts
import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { BusinessExceptionCodes } from '../../../../common/constants/business-exception-codes';

export class WorkoutByIdNotFoundException extends BusinessException {
  //#region Constructor
  public constructor(id: string) {
    super(
      BusinessExceptionCodes.WORKOUT_NOT_FOUND,
      `Workout whose id ${id} is not found`,
      HttpStatus.NOT_FOUND,
    );
  }
  //#endregion
}
```

- Entity-not-found follows the naming rule from [api.md](./api.md) §3.4:
  `<Entity>ByIdNotFoundException` / `<Entity>ByCodeNotFoundException` depending on the lookup key.
- **Translate low-level infrastructure errors into domain exceptions** at the service boundary — never
  let a raw driver error leak to the client. For example, a Postgres unique-violation becomes a
  domain "already exists" exception:

```ts
try {
  await this.__workoutRepository.insert(entity);
} catch (exception) {
  if (exception.code === PostgresExceptionCodes.UNIQUE_VIOLATION) {
    throw new WorkoutAlreadyExistsException(entity.userId, entity.date);
  }
  throw exception; // anything unexpected bubbles up to the unhandled filter (§3)
}
```

### 2.4. The filter

- Because `BusinessException` is an `HttpException`, the filter reads the declared status via
  `getStatus()` and serializes `code` + `message`:

```ts
// src/common/filters/business-exception.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { BusinessException } from '../exceptions/business.exception';

@Catch(BusinessException)
export class BusinessExceptionFilter implements ExceptionFilter {
  //#region Methods
  public catch(exception: BusinessException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(exception.getStatus()).json({
      code: exception.code,
      message: exception.message,
    });
  }
  //#endregion
}
```

- **Resulting response** — HTTP status from the exception (`404`, `409`, `403`, …):

```json
{ "code": "WORKOUT_NOT_FOUND", "message": "Workout whose id 123 is not found" }
```

## 3. Unhandled exception handling

This is the safety net: anything **not** a `ValidationException` or `BusinessException` — a
programming bug, a dependency outage, an un-translated driver error. The goal is to **never leak
internals** (stack traces, SQL, raw messages) to the client, while **logging the full detail**
server-side for diagnosis.

- A catch-all `@Catch()` filter (no argument ⇒ matches every exception) logs the real error and
  returns a fixed, generic `500` body. Known NestJS `HttpException`s that reached here (e.g. a
  framework `404` for an unknown route) keep their own status; everything else is normalized to `500`:

```ts
// src/common/filters/unhandled-exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BusinessExceptionCodes } from '../constants/business-exception-codes';

@Catch()
export class UnhandledExceptionFilter implements ExceptionFilter {
  //#region Fields
  private readonly __logger = new Logger(UnhandledExceptionFilter.name);
  //#endregion

  //#region Methods
  public catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Log the *full* detail server-side — stack included — for diagnosis.
    this.__logger.error(
      `Unhandled exception on ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    // Return a *safe*, generic body — never the raw message/stack.
    response.status(status).json({
      code: BusinessExceptionCodes.UNHANDLED,
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
  //#endregion
}
```

- **Do not** expose `exception.message` or the stack in the response — only the generic message above.
  The `Logger` call keeps the real cause available in server logs.
- This filter is the **last line of defense**; the two specific filters (§1, §2) handle their own
  types first (see §4 for ordering).

## 4. Registering the filters

- Filters are registered as **`APP_FILTER` providers** in a dedicated module — **not** with
  `app.useGlobalFilters(...)` in `main.ts` — so they participate in dependency injection (the
  `Logger`, any injected services) and stay testable:

```ts
// src/common/filters/exception-filter.module.ts
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { UnhandledExceptionFilter } from './unhandled-exception.filter';
import { BusinessExceptionFilter } from './business-exception.filter';
import { ValidationExceptionFilter } from './validation-exception.filter';

@Module({
  providers: [
    // Order matters — see note below.
    { provide: APP_FILTER, useClass: UnhandledExceptionFilter },
    { provide: APP_FILTER, useClass: BusinessExceptionFilter },
    { provide: APP_FILTER, useClass: ValidationExceptionFilter },
  ],
})
export class ExceptionFilterModule {}
```

```ts
// src/app/app.module.ts
@Module({
  imports: [
    ExceptionFilterModule,
    // ... feature modules
  ],
})
export class AppModule {}
```

- **Ordering rule.** NestJS applies `APP_FILTER` providers in **reverse** registration order and picks
  the most specific `@Catch` match. Register the **catch-all `UnhandledExceptionFilter` first** so it
  sits at the bottom of the chain, and the two specific filters after it. This guarantees:
  `ValidationException` → `400` filter, `BusinessException` → business filter, everything else →
  unhandled filter.
- Keep `main.ts` free of filter wiring — it only bootstraps (prefix, CORS, OpenAPI/Scalar gating,
  env validation), consistent with [api.md](./api.md) §1.
