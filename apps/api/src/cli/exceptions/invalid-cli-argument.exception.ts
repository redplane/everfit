/**
 * Thrown by the pure CLI argument parser (`parseCliArgs`) when the invocation is invalid: an
 * unknown/missing command, a destructive command without the required `--yes`/`--force` confirmation,
 * or a non-numeric / out-of-range `--count` / `--batch-size`. The CLI bootstrap catches it, prints the
 * message with usage, and exits non-zero. It is a plain `Error` subclass (CLI-only; not a
 * `BusinessException`, which is for the HTTP boundary).
 */
export class InvalidCliArgumentException extends Error {
  //#region Constructor
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidCliArgumentException';
  }
  //#endregion
}
