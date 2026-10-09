# I. Overview

This rule is about how to write **unit tests**. The goal is tests that fully exercise the code's
branches and failure modes, run deterministically, and are organized so related cases are easy to
find.

# II. Convention

## 1. Cover every branch

- **Every `if`/`else` case must be tested.** For each conditional branch (including the implicit
  `else` when one is not written, guard-clause early returns, and each `case`/`default` of a
  `switch`), there must be at least one test that drives execution down that path.
- If a branch **cannot** be unit tested, **report the reason** — leave an explicit note (a code
  comment next to the branch and/or a line in the test file or PR description) explaining why it is
  not covered (e.g. unreachable defensive branch, environment-only code path). Silent gaps are not
  acceptable.

```ts
// Code under test
public getDiscountAsync(user: UserEntity): Promise<number> {
  if (!user.isActive) {
    return Promise.resolve(0);       // branch A
  }

  if (user.isPremium) {
    return Promise.resolve(0.2);     // branch B
  }

  return Promise.resolve(0.05);      // branch C (implicit else)
}
```

```ts
// Tests — one case per branch
describe('getDiscountAsync', () => {
  it('returns 0 when the user is inactive', async () => { /* branch A */ });
  it('returns 0.2 when the user is premium', async () => { /* branch B */ });
  it('returns 0.05 for an active, non-premium user', async () => { /* branch C */ });
});
```

## 2. Test thrown exceptions exactly as defined

- If a function **throws an exception**, there must be a test asserting that the exception is thrown
  **exactly as the code defines it** — the same exception type, and where the code specifies it, the
  same message/fields.
- Assert the specific type (e.g. `UnsupportedWeightUnitException`), not just that "something threw".

```ts
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
it('throws UnsupportedWeightUnitException for an unknown unit', async () => {
  await expect(service.toKilogramAsync(1, 'STONE' as WeightUnits))
    .rejects.toThrow(UnsupportedWeightUnitException);
});
```

## 3. Use an in-memory database

- For unit tests, use an **in-memory database** rather than a shared or external database instance.
  This keeps tests fast, isolated, and deterministic, with no cross-test state leaking through a
  real server.

## 4. Meet a minimum coverage of 80%

- Test coverage **must be at least 80%**. Treat this as a floor, not a target — branch coverage
  (see §1) matters more than the headline percentage.

## 5. Group tests for the same function together

- Tests for the **same function must be grouped** — they must live in the **same file**, under a
  single `describe` block named after the function under test. Do not split a function's cases
  across multiple test files.

```ts
// ✅ All cases for getDiscountAsync in one file, under one describe
describe('getDiscountAsync', () => {
  it('returns 0 when the user is inactive', async () => { /* ... */ });
  it('returns 0.2 when the user is premium', async () => { /* ... */ });
  it('returns 0.05 for an active, non-premium user', async () => { /* ... */ });
});
```
