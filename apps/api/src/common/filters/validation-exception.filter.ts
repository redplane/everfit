import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ValidationException } from '../exceptions/validation.exception';
import { BusinessExceptionCodes } from '../constants/business-exception-codes';

@Catch(ValidationException)
export class ValidationExceptionFilter implements ExceptionFilter {
  //#region Methods
  public catch(exception: ValidationException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(HttpStatus.BAD_REQUEST).json({
      code: BusinessExceptionCodes.VALIDATION_ISSUE,
      issues: exception.issues,
    });
  }
  //#endregion
}
