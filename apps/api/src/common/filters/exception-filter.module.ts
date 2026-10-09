import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { UnhandledExceptionFilter } from './unhandled-exception.filter';
import { BusinessExceptionFilter } from './business-exception.filter';
import { ValidationExceptionFilter } from './validation-exception.filter';

@Module({
  providers: [
    // NestJS applies APP_FILTER providers in reverse registration order and picks the most
    // specific @Catch match. Register the catch-all first so it sits at the bottom of the chain
    // and the two specific filters take precedence.
    { provide: APP_FILTER, useClass: UnhandledExceptionFilter },
    { provide: APP_FILTER, useClass: BusinessExceptionFilter },
    { provide: APP_FILTER, useClass: ValidationExceptionFilter },
  ],
})
export class ExceptionFilterModule {}
