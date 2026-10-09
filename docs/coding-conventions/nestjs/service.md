# I. Overview

This document defines how **services** are structured in the NestJS project. A service owns the
business logic and data access for a feature — controllers stay thin and delegate to a service
(see `api.md` §3.5). Every service is defined **interface-first** and wired through an **injection
token**, so controllers and other services depend on the `I<Name>Service` contract rather than a
concrete class. This keeps implementations swappable (e.g. a unit-conversion strategy, a fake in
tests) without touching consumers.

> This refines the "interface + token only when multiple implementations are needed" note in
> `api.md` §3.5 and `../typescript/generic.md` §2: in this project **every** service follows the
> interface + token + module layout described below, consistently, regardless of how many
> implementations currently exist.

# II. Convention

## 1. Service folder layout

- Each service lives in its own folder under the owning module, in `kebab-case`:

  ```
  src/modules/<module-name>/services/<service-name>/
    ├── <service-name>-service.interface.ts       # IXxxService (the contract)
    ├── <service-name>.service.ts                 # XxxService implements IXxxService
    ├── <service-name>-injection-tokens.ts        # XxxServiceInjectionTokens enum
    └── <service-name>.module.ts                  # XxxServiceModule — provides via token
  ```

  For example, the `article` service:

  ```
  src/modules/article/services/article/
    ├── article-service.interface.ts
    ├── article.service.ts
    ├── article-injection-tokens.ts
    └── article.module.ts
  ```

- **One declaration per file** (see `../typescript/generic.md` §1) — the interface, each class,
  the enum, and the module each live in their own file.

## 2. The interface — `I<Name>Service`

- Every service exposes an interface named `I<Name>Service` (PascalCase, `I` prefix), declared in
  `<service-name>-service.interface.ts`.
- The interface describes the **contract only** — method signatures, no implementation. Methods
  returning a `Promise` carry the `Async` suffix (see `../typescript/generic.md` §2).

```ts
// src/modules/article/services/article/article-service.interface.ts
import { ArticleEntity } from '../../entities/article.entity';
import { CreateArticleOptions } from '../../../../models/options/create-article-options';

export interface IArticleService {
  //#region Methods
  getByIdAsync(id: string): Promise<ArticleEntity>;
  createAsync(options: CreateArticleOptions): Promise<ArticleEntity>;
  updateByIdAsync(id: string, options: UpdateArticleOptions): Promise<ArticleEntity>;
  deleteByIdAsync(id: string): Promise<void>;
  //#endregion
}
```

## 3. The implementation — `<Name>Service`

- A concrete implementation is an `@Injectable()` class named `<Name>Service` that **implements**
  its interface: `export class ArticleService implements IArticleService`.
- Dependencies are injected through the constructor; tokens are resolved with `@Inject(TOKEN)`
  (see `../typescript/generic.md` §2 for constructor / `#region` rules).
- More than one implementation of the same interface is allowed (e.g. a real and a stubbed
  variant, or alternative strategies). Each implementation is its own `<name>.service.ts` file and
  gets its own token member in the enum (§4).

```ts
// src/modules/article/services/article/article.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { IArticleService } from './article-service.interface';

@Injectable()
export class ArticleService implements IArticleService {
  //#region Constructor
  public constructor(
    @Inject(InjectionTokens.SERVICE__DATE_TIME_CONTEXT)
    private readonly __dateTimeContext: IDateTimeContext,
  ) {}
  //#endregion

  //#region Methods
  public async getByIdAsync(id: string): Promise<ArticleEntity> {
    // ...
  }
  //#endregion
}
```

## 4. Injection tokens — `<service-name>-injection-tokens.ts`

- Each service folder has a token file named `<service-name>-injection-tokens.ts` that exports a
  single `enum` named `<Name>ServiceInjectionTokens`.
- The enum holds the injection constant(s) for that service. Each member is `SERVICE__<NAME>` in
  `SNAKE_UPPER_CASE`, and its **value equals its name** (see `../typescript/generic.md` §2 on
  enums):

```ts
// src/modules/user/services/user/user-injection-tokens.ts
export enum UserServiceInjectionTokens {
  SERVICE__USER = 'SERVICE__USER',
}
```

```ts
// src/modules/article/services/article/article-injection-tokens.ts
export enum ArticleServiceInjectionTokens {
  SERVICE__ARTICLE = 'SERVICE__ARTICLE',
}
```

- When a service has more than one implementation, add one member per implementation, each named
  for what it binds (e.g. `SERVICE__ARTICLE`, `SERVICE__ARTICLE__CACHED`).

## 5. The service module — `<service-name>.module.ts`

- Each service folder has a `<service-name>.module.ts` exporting a module class
  `<Name>ServiceModule`. The module **provides the service under its injection token** using
  `{ provide, useClass }`, and **exports** the token so other modules can consume the service.
- Consumers never reference the concrete class — they `@Inject(<Name>ServiceInjectionTokens.SERVICE__XXX)`
  and depend on `I<Name>Service`.

```ts
// src/modules/article/services/article/article.module.ts
import { Module } from '@nestjs/common';
import { ArticleService } from './article.service';
import { ArticleServiceInjectionTokens } from './article-injection-tokens';

@Module({
  providers: [
    {
      provide: ArticleServiceInjectionTokens.SERVICE__ARTICLE,
      useClass: ArticleService,
    },
  ],
  exports: [ArticleServiceInjectionTokens.SERVICE__ARTICLE],
})
export class ArticleServiceModule {}
```

- A feature's API module (`<module-name>-api.module.ts`, see `api.md` §2.1) imports the service
  module(s) it needs rather than registering providers inline.

## 6. Consuming a service

- Inject the contract via the token wherever the service is needed (controller or another service):

```ts
@Controller({ path: 'api/article' })
export class ArticleApiController {
  //#region Constructor
  public constructor(
    @Inject(ArticleServiceInjectionTokens.SERVICE__ARTICLE)
    private readonly __articleService: IArticleService,
  ) {}
  //#endregion
}
```

- The dependency type is always the **interface** (`IArticleService`), never the concrete class —
  this is what makes implementations swappable and keeps tests able to bind a fake to the same
  token.
