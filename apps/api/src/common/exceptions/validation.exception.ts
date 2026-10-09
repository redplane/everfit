import { ValidationIssue } from '../models/validation-issue';

export class ValidationException {
  //#region Constructor
  public constructor(public readonly issues: ValidationIssue[]) {}
  //#endregion
}
