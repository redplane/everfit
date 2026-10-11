import { apiDocumentConfig } from './api-document.config';

describe('apiDocumentConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('enables docs when API_DOCUMENT__ENABLED is "true"', () => {
    process.env.API_DOCUMENT__ENABLED = 'true';

    const config = apiDocumentConfig();

    expect(config.enabled).toBe(true);
  });

  it('disables docs when API_DOCUMENT__ENABLED is unset', () => {
    delete process.env.API_DOCUMENT__ENABLED;

    const config = apiDocumentConfig();

    expect(config.enabled).toBe(false);
  });

  it('disables docs when API_DOCUMENT__ENABLED is any non-"true" value', () => {
    process.env.API_DOCUMENT__ENABLED = 'yes';

    const config = apiDocumentConfig();

    expect(config.enabled).toBe(false);
  });
});
