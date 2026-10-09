import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { ValidationExceptionFilter } from './validation-exception.filter';
import { ValidationException } from '../exceptions/validation.exception';
import { ValidationIssue } from '../models/validation-issue';
import { BusinessExceptionCodes } from '../constants/business-exception-codes';

describe('ValidationExceptionFilter.catch', () => {
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

  it('responds 400 with the VALIDATION_ISSUE code and the issues array', () => {
    const filter = new ValidationExceptionFilter();
    const { host, status, json } = createHost();
    const issues = [new ValidationIssue('"userId" is required')];

    filter.catch(new ValidationException(issues), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      code: BusinessExceptionCodes.VALIDATION_ISSUE,
      issues,
    });
  });

  it('passes an empty issues array through unchanged', () => {
    const filter = new ValidationExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new ValidationException([]), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      code: BusinessExceptionCodes.VALIDATION_ISSUE,
      issues: [],
    });
  });
});
