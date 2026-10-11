import { CliCommand } from '../cli-command';

/**
 * The fully-parsed, validated result of a CLI invocation (produced by the pure `parseCliArgs`). The
 * bootstrap consumes this to decide what to run; keeping it a plain data object (no I/O) makes the
 * parsing fully unit-testable.
 */
export interface CliInvocation {
  //#region Properties
  /** The command to run. */
  command: CliCommand;

  /** Number of workout entries to seed (`--count`, default 50,000). Ignored by `reset`. */
  count: number;

  /** Bulk-insert chunk size (`--batch-size`, default 2,000). Ignored by `reset`. */
  batchSize: number;

  /**
   * Optional target user id (`--user`) to receive the seeded workouts; when omitted, the demo user
   * created by the master-data seed is used. Ignored by `reset`.
   */
  userId?: string;
  //#endregion
}
