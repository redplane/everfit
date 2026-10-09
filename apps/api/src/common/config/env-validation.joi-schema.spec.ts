import { envValidationJoiSchema } from './env-validation.joi-schema';

describe('envValidationJoiSchema', () => {
  const validEnv = {
    DATABASE__HOST: 'localhost',
    DATABASE__USERNAME: 'postgres',
    DATABASE__PASSWORD: 'secret',
    DATABASE__NAME: 'everfit',
  };

  it('passes when all required variables are present', () => {
    const { error } = envValidationJoiSchema.validate(validEnv);

    expect(error).toBeUndefined();
  });

  it('applies defaults for omitted optional variables', () => {
    const { error, value } = envValidationJoiSchema.validate(validEnv);

    expect(error).toBeUndefined();
    expect(value.NODE_ENV).toBe('development');
    expect(value.PORT).toBe(3000);
    expect(value.DATABASE__PORT).toBe(5432);
    expect(value.API_DOCUMENT__ENABLED).toBe(false);
  });

  it('coerces provided optional variables', () => {
    const { error, value } = envValidationJoiSchema.validate({
      ...validEnv,
      PORT: '8080',
      DATABASE__PORT: '6543',
      API_DOCUMENT__ENABLED: 'true',
    });

    expect(error).toBeUndefined();
    expect(value.PORT).toBe(8080);
    expect(value.DATABASE__PORT).toBe(6543);
    expect(value.API_DOCUMENT__ENABLED).toBe(true);
  });

  it('fails when DATABASE__HOST is missing', () => {
    const { DATABASE__HOST, ...rest } = validEnv;
    void DATABASE__HOST;

    const { error } = envValidationJoiSchema.validate(rest);

    expect(error).toBeDefined();
  });

  it('fails when DATABASE__USERNAME is missing', () => {
    const { DATABASE__USERNAME, ...rest } = validEnv;
    void DATABASE__USERNAME;

    const { error } = envValidationJoiSchema.validate(rest);

    expect(error).toBeDefined();
  });

  it('fails when DATABASE__PASSWORD is missing', () => {
    const { DATABASE__PASSWORD, ...rest } = validEnv;
    void DATABASE__PASSWORD;

    const { error } = envValidationJoiSchema.validate(rest);

    expect(error).toBeDefined();
  });

  it('fails when DATABASE__NAME is missing', () => {
    const { DATABASE__NAME, ...rest } = validEnv;
    void DATABASE__NAME;

    const { error } = envValidationJoiSchema.validate(rest);

    expect(error).toBeDefined();
  });

  it('fails when PORT is not a number', () => {
    const { error } = envValidationJoiSchema.validate({
      ...validEnv,
      PORT: 'not-a-number',
    });

    expect(error).toBeDefined();
  });

  it('fails when NODE_ENV is not an allowed value', () => {
    const { error } = envValidationJoiSchema.validate({
      ...validEnv,
      NODE_ENV: 'staging',
    });

    expect(error).toBeDefined();
  });
});
