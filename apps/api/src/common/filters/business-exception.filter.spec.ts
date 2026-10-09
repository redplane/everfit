import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { BusinessExceptionFilter } from './business-exception.filter';
import { BusinessException } from '../exceptions/business.exception';

describe('BusinessExceptionFilter.catch', () => {
  //#region Helpers
  const createHost = (): {
    host: ArgumentsHost;
    status: jest.Mock;
    json: jest.Mock;
  } => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;
    return { host, status, json };
  };
  //#endregion

  it('responds with the exception declared status, code and message', () => {
    const filter = new BusinessExceptionFilter();
    const { host, status, json } = createHost();
    const exception = new BusinessException(
      'WORKOUT_NOT_FOUND',
      'Workout whose id 123 is not found',
      HttpStatus.NOT_FOUND,
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      code: 'WORKOUT_NOT_FOUND',
      message: 'Workout whose id 123 is not found',
    });
  });

  it('falls back to the BusinessException default 400 status when none is given', () => {
    const filter = new BusinessExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new BusinessException('SOME_RULE', 'Some rule violated'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      code: 'SOME_RULE',
      message: 'Some rule violated',
    });
  });
});
