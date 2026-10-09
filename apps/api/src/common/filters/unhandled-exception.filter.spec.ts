import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { UnhandledExceptionFilter } from './unhandled-exception.filter';
import { BusinessExceptionCodes } from '../constants/business-exception-codes';

describe('UnhandledExceptionFilter.catch', () => {
  //#region Helpers
  const createHost = (): {
    host: ArgumentsHost;
    status: jest.Mock;
    json: jest.Mock;
  } => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const request = { method: 'GET', url: '/api/workout' };
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;
    return { host, status, json };
  };

  const SAFE_BODY = {
    code: BusinessExceptionCodes.UNHANDLED,
    message: 'An unexpected error occurred. Please try again later.',
  };

  beforeEach(() => {
    // Silence the error log so the test output stays clean.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  //#endregion

  it('normalizes a non-HttpException Error to 500 with a safe body', () => {
    const filter = new UnhandledExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new Error('connection pool exhausted'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(SAFE_BODY);
  });

  it('keeps an HttpException declared status but still returns the safe body', () => {
    const filter = new UnhandledExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new HttpException('Not Found', HttpStatus.NOT_FOUND), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(SAFE_BODY);
  });

  it('handles a non-Error thrown value (e.g. a string) as 500', () => {
    const filter = new UnhandledExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch('boom', host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(SAFE_BODY);
  });

  it('logs the error with a stack for a real Error', () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const filter = new UnhandledExceptionFilter();
    const { host } = createHost();
    const error = new Error('db down');

    filter.catch(error, host);

    expect(errorSpy).toHaveBeenCalledWith(
      'Unhandled exception on GET /api/workout',
      error.stack,
    );
  });

  it('logs the stringified value when the thrown value is not an Error', () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const filter = new UnhandledExceptionFilter();
    const { host } = createHost();

    filter.catch('boom', host);

    expect(errorSpy).toHaveBeenCalledWith(
      'Unhandled exception on GET /api/workout',
      'boom',
    );
  });
});
