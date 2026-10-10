import { timezoneJoiSchema } from './timezone.joi-schema';

describe('timezoneJoiSchema', () => {
  it('accepts a valid IANA zone (Asia/Ho_Chi_Minh)', () => {
    const { error, value } = timezoneJoiSchema.validate('Asia/Ho_Chi_Minh');

    expect(error).toBeUndefined();
    expect(value).toBe('Asia/Ho_Chi_Minh');
  });

  it('accepts "UTC"', () => {
    const { error, value } = timezoneJoiSchema.validate('UTC');

    expect(error).toBeUndefined();
    expect(value).toBe('UTC');
  });

  it('accepts a DST zone (America/New_York)', () => {
    const { error, value } = timezoneJoiSchema.validate('America/New_York');

    expect(error).toBeUndefined();
    expect(value).toBe('America/New_York');
  });

  it('rejects an unknown zone (RangeError branch)', () => {
    const { error } = timezoneJoiSchema.validate('Mars/Phobos');

    expect(error).toBeDefined();
  });

  it('rejects an empty string', () => {
    const { error } = timezoneJoiSchema.validate('');

    expect(error).toBeDefined();
  });

  it('rejects a non-string value', () => {
    const { error } = timezoneJoiSchema.validate(123);

    expect(error).toBeDefined();
  });
});
