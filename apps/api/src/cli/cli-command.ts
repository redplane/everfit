/**
 * The commands the database CLI accepts (F9). The enum value is the literal typed on the command
 * line (`pnpm nx run api:db-cli -- <command>`):
 * - `RESET` — clear all domain data (requires `--yes`/`--force`).
 * - `SEED` — insert master data + a large workout dataset (expects a clean DB; reset first).
 * - `RESET_SEED` — reset then seed in one run (the recommended one-shot for the demo).
 */
export enum CliCommand {
  RESET = 'reset',
  SEED = 'seed',
  RESET_SEED = 'reset-seed',
}
