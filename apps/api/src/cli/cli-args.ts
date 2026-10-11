import { CliCommand } from './cli-command';
import { CliInvocation } from './models/cli-invocation';
import { InvalidCliArgumentException } from './exceptions/invalid-cli-argument.exception';

/** Default number of workout entries to seed when `--count` is omitted (the demo target is 50,000+). */
export const DEFAULT_SEED_COUNT = 50_000;

/** Default bulk-insert chunk size when `--batch-size` is omitted. */
export const DEFAULT_BATCH_SIZE = 2_000;

/** The commands that clear data and therefore require an explicit `--yes`/`--force` confirmation. */
const DESTRUCTIVE_COMMANDS: readonly CliCommand[] = [CliCommand.RESET, CliCommand.RESET_SEED];

/** Usage text appended to error messages so a misuse is self-explanatory. */
export const CLI_USAGE =
  'Usage: db-cli <reset|seed|reset-seed> [--yes|--force] [--count <n>] ' +
  '[--batch-size <n>] [--user <uuid>]';

/**
 * Parses the raw CLI argument list into a validated {@link CliInvocation}. Pure (no I/O), so every
 * branch is unit-testable without a database.
 *
 * Throws {@link InvalidCliArgumentException} when:
 * - no command is given, or the command is not one of `reset` / `seed` / `reset-seed`;
 * - a destructive command (`reset` / `reset-seed`) is missing the required `--yes`/`--force` flag;
 * - `--count` / `--batch-size` is present but not a positive integer;
 * - a flag that expects a value (`--count` / `--batch-size` / `--user`) is given without one.
 *
 * @param argv the arguments **after** the command name (i.e. `process.argv.slice(2)`).
 */
export function parseCliArgs(argv: string[]): CliInvocation {
  const [commandToken, ...rest] = argv;

  if (commandToken === undefined) {
    throw new InvalidCliArgumentException(`A command is required. ${CLI_USAGE}`);
  }

  const command = toCommand(commandToken);

  let force = false;
  let count = DEFAULT_SEED_COUNT;
  let batchSize = DEFAULT_BATCH_SIZE;
  let userId: string | undefined;

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    switch (token) {
      case '--yes':
      case '--force':
        force = true;
        break;
      case '--count':
        count = readPositiveInteger('--count', rest[index + 1]);
        index += 1;
        break;
      case '--batch-size':
        batchSize = readPositiveInteger('--batch-size', rest[index + 1]);
        index += 1;
        break;
      case '--user':
        userId = readValue('--user', rest[index + 1]);
        index += 1;
        break;
      default:
        throw new InvalidCliArgumentException(`Unknown option "${token}". ${CLI_USAGE}`);
    }
  }

  if (DESTRUCTIVE_COMMANDS.includes(command) && !force) {
    throw new InvalidCliArgumentException(
      `"${command}" clears data and requires confirmation. Re-run with --yes (or --force). ${CLI_USAGE}`,
    );
  }

  return { command, count, batchSize, userId };
}

/** Maps a raw token to a {@link CliCommand}, or throws for an unknown command. */
function toCommand(token: string): CliCommand {
  switch (token) {
    case CliCommand.RESET:
      return CliCommand.RESET;
    case CliCommand.SEED:
      return CliCommand.SEED;
    case CliCommand.RESET_SEED:
      return CliCommand.RESET_SEED;
    default:
      throw new InvalidCliArgumentException(`Unknown command "${token}". ${CLI_USAGE}`);
  }
}

/** Reads a value that must be present for a flag, or throws when it is missing. */
function readValue(flag: string, raw: string | undefined): string {
  if (raw === undefined || raw.startsWith('--')) {
    throw new InvalidCliArgumentException(`Option "${flag}" requires a value. ${CLI_USAGE}`);
  }

  return raw;
}

/** Reads a flag value and validates it is a positive integer, or throws. */
function readPositiveInteger(flag: string, raw: string | undefined): number {
  const value = Number(readValue(flag, raw));

  if (!Number.isInteger(value) || value < 1) {
    throw new InvalidCliArgumentException(
      `Option "${flag}" must be a positive integer. ${CLI_USAGE}`,
    );
  }

  return value;
}
