import { weightUnitJoiSchema } from './weight-unit.joi-schema';

describe('weightUnitJoiSchema', () => {
  it('accepts "kg"', () => {
    const { error, value } = weightUnitJoiSchema.validate('kg');

    expect(error).toBeUndefined();
    expect(value).toBe('kg');
  });

  it('accepts "lb"', () => {
    const { error, value } = weightUnitJoiSchema.validate('lb');

    expect(error).toBeUndefined();
    expect(value).toBe('lb');
  });

  it('rejects an unknown unit code', () => {
    const { error } = weightUnitJoiSchema.validate('stone');

    expect(error).toBeDefined();
  });

  it('rejects a non-string value', () => {
    const { error } = weightUnitJoiSchema.validate(123);

    expect(error).toBeDefined();
  });
});
