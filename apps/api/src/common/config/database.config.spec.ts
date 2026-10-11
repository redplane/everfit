import { databaseConfig } from './database.config';

describe('databaseConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('maps all DATABASE__* variables into the namespace', () => {
    process.env.DATABASE__HOST = 'db-host';
    process.env.DATABASE__PORT = '6543';
    process.env.DATABASE__USERNAME = 'admin';
    process.env.DATABASE__PASSWORD = 'pw';
    process.env.DATABASE__NAME = 'everfit';

    const config = databaseConfig();

    expect(config).toEqual({
      host: 'db-host',
      port: 6543,
      username: 'admin',
      password: 'pw',
      name: 'everfit',
    });
  });

  it('falls back to port 5432 when DATABASE__PORT is unset', () => {
    delete process.env.DATABASE__PORT;
    process.env.DATABASE__HOST = 'db-host';

    const config = databaseConfig();

    expect(config.port).toBe(5432);
  });
});
