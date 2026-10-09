# I. Overview

This rule is about **self-documenting code**. Names and comments are the cheapest documentation we
have — they travel with the code and are read far more often than they are written. The goal is that
anyone can understand *what* a method does and *why* a variable exists without reverse-engineering
the implementation.

These are language- and framework-agnostic habits; they apply to every file in the repository.

# II. Convention

## 1. Method names must be meaningful

- A method name states **what it does**, as a verb phrase, specific enough that a reader knows the
  behaviour without opening the body — `calculateOneRepMaxAsync`, `findActiveUsersAsync`,
  `toKilogramAsync`. Avoid vague verbs that could mean anything: `handle`, `process`, `doWork`,
  `manage`, `data2`.
- Match the established verb vocabulary of the codebase (e.g. the `…Async` suffix for async
  handlers, `create`/`search`/`update` handler naming) rather than inventing a synonym.
- The name should not lie: a method called `getUser` must not also mutate state; a `validate…`
  method must not silently transform its input.

```ts
// ✅ Meaningful — the name tells you exactly what happens
public async calculatePersonalRecordAsync(entries: WorkoutEntry[]): Promise<number> { ... }

// ❌ Vague — you must read the body to know what it does
public async handle(data: WorkoutEntry[]): Promise<number> { ... }
```

## 2. Variable names must be meaningful

- Name a variable after **what it holds**, not its type or a throwaway letter:
  `kilogramValue`, `activeUserCount`, `personalRecordByExercise` — not `x`, `tmp`, `arr`, `val2`.
- Booleans read as a yes/no question or state: `isActive`, `hasPersonalRecord`, `canConvert`.
- Collections are plural (`users`, `entriesByDate`); a single item is singular (`user`, `entry`).
- Short-lived loop indices (`i`, `j`) are acceptable, but prefer a descriptive name the moment the
  loop body is non-trivial.

```ts
// ✅ Meaningful
const activeUserCount = users.filter((user) => user.isActive).length;

// ❌ Meaningless
const n = u.filter((a) => a.b).length;
```

## 3. Comments for methods and variables are required

- **Every method** carries a short doc comment (`/** … */`) saying **what it does**, and — where it
  isn't obvious — **why**, its parameters, what it returns, and which exceptions it throws. Prefer
  explaining intent and edge cases over restating the signature.
- **Every non-trivial variable** (configuration keys, magic numbers, normalized/derived values,
  anything whose purpose isn't obvious from the name alone) gets a brief comment explaining what it
  represents and its unit/shape where relevant.
- Comments explain **why**, not **what the code literally says** — a comment that merely repeats the
  statement is noise. Keep comments **in sync** with the code; a stale comment is worse than none.

```ts
/**
 * Converts a weight to kilograms, the canonical storage unit.
 * @throws UnsupportedWeightUnitException when the unit is not supported.
 */
public toKilogramAsync(value: number, unit: WeightUnits): Promise<number> {
  // Pound → kilogram factor (NIST). Stored normalized so aggregation is unit-agnostic.
  const poundToKilogram = 0.453592;
  ...
}
```

# III. Why this matters

Linting enforces *structure* (formatting, imports, folder layout); it cannot judge whether a name is
*meaningful*. That judgement is a human review concern — the reviewer checks that method names,
variable names, and comments make the code understandable, while the lint script handles the
mechanical conventions.
