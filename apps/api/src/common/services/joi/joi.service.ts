import { Injectable } from '@nestjs/common';
import Joi from 'joi';
import { IJoiService } from './joi-service.interface';
import { ValidationException } from '../../exceptions/validation.exception';
import { ValidationIssue } from '../../models/validation-issue';

@Injectable()
export class JoiService implements IJoiService {
  //#region Methods
  /**
   * Validates (and coerces) `instance` against `schema`. On a Joi validation error the
   * collected details are mapped to a {@link ValidationException}; any other error is
   * re-thrown unchanged so it reaches the unhandled filter.
   */
  public async validateAsync<T>(instance: T, schema: Joi.Schema<T>): Promise<T> {
    try {
      return await schema.validateAsync(instance, { convert: true });
    } catch (exception: unknown) {
      const error = exception as Record<string, unknown>;
      if (error['details'] instanceof Array) {
        const issues = error['details'].map(
          (detail: Joi.ValidationErrorItem) => new ValidationIssue(detail.message),
        );
        throw new ValidationException(issues);
      }
      throw exception;
    }
  }
  //#endregion
}
