# I. Overview

This document specifies how the **time context** is wired in this NestJS project. It builds on the
framework-agnostic rule in **[../best-practices/time-with-di.md](../best-practices/time-with-di.md)**:
never read the current time from `new Date()` / `Date.now()` directly — obtain it from an injected
time context so it stays deterministic (and fakeable) in unit tests.

In NestJS, the time context is wired exactly like a service (see **[service.md](./service.md)**):
an interface, an implementation, an injection-token enum, and a dedicated module.

# II. Convention

## 1. Layout

```
src/common/time-context/
  ├── time-context.interface.ts          # ITimeContext (the contract)
  ├── time-context.ts                     # TimeContext implements ITimeContext
  ├── time-context-injection-tokens.ts    # TimeContextInjectionTokens enum
  └── time-context.module.ts              # TimeContextModule — provides via token
```

## 2. The contract and implementation

- Declare an interface `ITimeContext` exposing `getUtcNowAsync()`, and a `TimeContext` class that
  implements it. The method returns the current **UTC** time and carries the `Async` suffix
  (see `../typescript/generic.md`).

```ts
// src/common/time-context/time-context.interface.ts
export interface ITimeContext {
  //#region Methods
  getUtcNowAsync(): Promise<Date>;
  //#endregion
}
```

```ts
// src/common/time-context/time-context.ts
import { Injectable } from '@nestjs/common';
import { ITimeContext } from './time-context.interface';

@Injectable()
export class TimeContext implements ITimeContext {
  //#region Methods
  public async getUtcNowAsync(): Promise<Date> {
    return new Date();
  }
  //#endregion
}
```

> `TimeContext` is the **only** place a raw `new Date()` is allowed — it is the boundary that the
> rest of the codebase depends on instead of the system clock.

## 3. Injection token

- Declare the token in `time-context-injection-tokens.ts` as an enum whose member value equals its
  name (see `../typescript/generic.md` on enums):

```ts
// src/common/time-context/time-context-injection-tokens.ts
export enum TimeContextInjectionTokens {
  CONTEXT__TIME = 'CONTEXT__TIME',
}
```

## 4. The module

- A `TimeContextModule` provides `TimeContext` under the token and **exports** it so any feature
  module can import the module and inject the context.

```ts
// src/common/time-context/time-context.module.ts
import { Module } from '@nestjs/common';
import { TimeContext } from './time-context';
import { TimeContextInjectionTokens } from './time-context-injection-tokens';

@Module({
  providers: [
    {
      provide: TimeContextInjectionTokens.CONTEXT__TIME,
      useClass: TimeContext,
    },
  ],
  exports: [TimeContextInjectionTokens.CONTEXT__TIME],
})
export class TimeContextModule {}
```

## 5. Consuming the time context

- Import `TimeContextModule` in the module that needs time, then inject the contract via the token
  and call `getUtcNowAsync()` — never `new Date()` / `Date.now()`.

```ts
@Injectable()
export class WorkoutService implements IWorkoutService {
  //#region Constructor
  public constructor(
    @Inject(TimeContextInjectionTokens.CONTEXT__TIME)
    private readonly __timeContext: ITimeContext,
  ) {}
  //#endregion

  //#region Methods
  public async createAsync(options: CreateWorkoutOptions): Promise<WorkoutEntity> {
    const now = await this.__timeContext.getUtcNowAsync();
    // ... use `now` as the created time
  }
  //#endregion
}
```

- The injected dependency type is always the interface `ITimeContext`, so a test can bind a fake
  that returns a fixed instant to `TimeContextInjectionTokens.CONTEXT__TIME`.
