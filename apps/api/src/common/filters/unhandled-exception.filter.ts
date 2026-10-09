import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BusinessExceptionCodes } from '../constants/business-exception-codes';

@Catch()
export class UnhandledExceptionFilter implements ExceptionFilter {
  //#region Properties
  private readonly __logger = new Logger(UnhandledExceptionFilter.name);
  //#endregion

  //#region Methods
  public catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Log the full detail server-side — stack included — for diagnosis.
    this.__logger.error(
      `Unhandled exception on ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    // Return a safe, generic body — never the raw message/stack.
    response.status(status).json({
      code: BusinessExceptionCodes.UNHANDLED,
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
  //#endregion
}
