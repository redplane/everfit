# I. Overview

This rule is about how to structure **conditional branches**. The goal is flat, early-exit code
that is easy to read and avoids deep nesting.

# II. Convention

## 1. Prefer `if ... return` over `if/else`

- **Prioritize guard clauses** — `if (condition) return ...;` — over `if/else` blocks. Handle the
  special/early case first and return, letting the main path continue at the top indentation level.
- **Only `return` inside the `if` when we do not want to handle any other logic after the condition
  check.** The early `return` is appropriate precisely because nothing else needs to happen once the
  condition is matched — the method exits there.
- Use `if/else` **only** when there **is additional logic to run after the condition check** that
  depends on both branches (i.e. the method does not simply return out of each branch).

```ts
// ✅ Preferred — guard clauses, early return, no nesting
public getDiscountAsync(user: UserEntity): Promise<number> {
  if (!user.isActive) {
    return Promise.resolve(0);
  }

  if (user.isPremium) {
    return Promise.resolve(0.2);
  }

  return Promise.resolve(0.05);
}
```

```ts
// ❌ Avoid — unnecessary else nesting when each branch just returns
public getDiscountAsync(user: UserEntity): Promise<number> {
  if (!user.isActive) {
    return Promise.resolve(0);
  } else {
    if (user.isPremium) {
      return Promise.resolve(0.2);
    } else {
      return Promise.resolve(0.05);
    }
  }
}
```

```ts
// ✅ Acceptable — if/else is fine because work happens AFTER the branch,
// using a value both branches contribute to.
public async createAsync(options: CreateWorkoutOptions): Promise<WorkoutEntity> {
  let unit: string;
  if (options.unit) {
    unit = options.unit;
  } else {
    unit = this.__defaultUnit;
  }

  return this.__repository.saveAsync({ ...options, unit });
}
```

## 2. Use `switch`/`case` with `return` for a limited, specific set of values

- When the condition branches on a **specific, limited set of data** (an enum, a status, a fixed
  set of string/number codes), use a `switch` statement where each `case` **returns**, instead of
  an `if/else if/else` chain.
- Each `case` returns directly (no `break` needed after a `return`), and a `default` case handles
  the unexpected value — return a fallback or throw.

```ts
// ✅ Preferred — switch/case with return over an if/else-if chain on a fixed set
public toKilogramAsync(value: number, unit: WeightUnits): Promise<number> {
  switch (unit) {
    case WeightUnits.KILOGRAM:
      return Promise.resolve(value);
    case WeightUnits.POUND:
      return Promise.resolve(value * 0.453592);
    default:
      throw new UnsupportedWeightUnitException(unit);
  }
}
```

```ts
// ❌ Avoid — if/else-if chain over a limited, known set of values
public toKilogramAsync(value: number, unit: WeightUnits): Promise<number> {
  if (unit === WeightUnits.KILOGRAM) {
    return Promise.resolve(value);
  } else if (unit === WeightUnits.POUND) {
    return Promise.resolve(value * 0.453592);
  } else {
    throw new UnsupportedWeightUnitException(unit);
  }
}
```
