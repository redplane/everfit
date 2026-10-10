import { parseCliArgs, DEFAULT_SEED_COUNT, DEFAULT_BATCH_SIZE } from './cli-args';
import { CliCommand } from './cli-command';
import { InvalidCliArgumentException } from './exceptions/invalid-cli-argument.exception';

describe('parseCliArgs', () => {
  it('parses the seed command with defaults', () => {
    const result = parseCliArgs(['seed']);

    expect(result).toEqual({
      command: CliCommand.SEED,
      count: DEFAULT_SEED_COUNT,
      batchSize: DEFAULT_BATCH_SIZE,
      userId: undefined,
    });
  });

  it('parses the reset command when confirmed with --yes', () => {
    expect(parseCliArgs(['reset', '--yes']).command).toBe(CliCommand.RESET);
  });

  it('accepts --force as the confirmation for a destructive command', () => {
    expect(parseCliArgs(['reset', '--force']).command).toBe(CliCommand.RESET);
  });

  it('parses the reset-seed command when confirmed', () => {
    expect(parseCliArgs(['reset-seed', '--yes']).command).toBe(CliCommand.RESET_SEED);
  });

  it('parses --count, --batch-size and --user overrides', () => {
    const result = parseCliArgs([
      'seed',
      '--count',
      '1000',
      '--batch-size',
      '250',
      '--user',
      'user-123',
    ]);

    expect(result).toEqual({
      command: CliCommand.SEED,
      count: 1000,
      batchSize: 250,
      userId: 'user-123',
    });
  });

  it('throws InvalidCliArgumentException when no command is given', () => {
    expect(() => parseCliArgs([])).toThrow(InvalidCliArgumentException);
  });

  it('throws InvalidCliArgumentException for an unknown command', () => {
    expect(() => parseCliArgs(['explode'])).toThrow(InvalidCliArgumentException);
  });

  it('throws InvalidCliArgumentException for an unknown option', () => {
    expect(() => parseCliArgs(['seed', '--nope'])).toThrow(InvalidCliArgumentException);
  });

  it('throws InvalidCliArgumentException when reset is missing confirmation', () => {
    expect(() => parseCliArgs(['reset'])).toThrow(InvalidCliArgumentException);
  });

  it('throws InvalidCliArgumentException when reset-seed is missing confirmation', () => {
    expect(() => parseCliArgs(['reset-seed'])).toThrow(InvalidCliArgumentException);
  });

  it('throws InvalidCliArgumentException when --count is not an integer', () => {
    expect(() => parseCliArgs(['seed', '--count', 'abc'])).toThrow(InvalidCliArgumentException);
  });

  it('throws InvalidCliArgumentException when --count is below 1', () => {
    expect(() => parseCliArgs(['seed', '--count', '0'])).toThrow(InvalidCliArgumentException);
  });

  it('throws InvalidCliArgumentException when --batch-size is not a positive integer', () => {
    expect(() => parseCliArgs(['seed', '--batch-size', '-5'])).toThrow(InvalidCliArgumentException);
  });

  it('throws InvalidCliArgumentException when --count is missing its value', () => {
    expect(() => parseCliArgs(['seed', '--count'])).toThrow(InvalidCliArgumentException);
  });

  it('throws InvalidCliArgumentException when --user value looks like another flag', () => {
    expect(() => parseCliArgs(['seed', '--user', '--count'])).toThrow(InvalidCliArgumentException);
  });
});
