import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CliModule } from './cli.module';
import { CliCommand } from './cli-command';
import { parseCliArgs } from './cli-args';
import { CliInvocation } from './models/cli-invocation';
import { InvalidCliArgumentException } from './exceptions/invalid-cli-argument.exception';
import { ISeedService } from './services/seed/seed-service.interface';
import { SeedServiceInjectionTokens } from './services/seed/seed-injection-tokens';

/**
 * Entry point for the database CLI (F9): `reset`, `seed`, `reset-seed`. Builds a Nest standalone
 * application context (no HTTP server), resolves the seed service, runs the requested command, logs
 * row counts and elapsed time, then closes the context and exits with the appropriate code.
 */
async function main(): Promise<void> {
  const logger = new Logger('DatabaseCli');

  let invocation: CliInvocation;
  try {
    invocation = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof InvalidCliArgumentException) {
      logger.error(error.message);
      process.exitCode = 1;
      return;
    }

    throw error;
  }

  const context = await NestFactory.createApplicationContext(CliModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const seedService = context.get<ISeedService>(SeedServiceInjectionTokens.SERVICE__SEED);
    const startedAt = Date.now();

    if (invocation.command === CliCommand.RESET || invocation.command === CliCommand.RESET_SEED) {
      logger.log('Resetting database (clearing all domain data)...');
      await seedService.resetAsync();
      logger.log('Reset complete.');
    }

    if (invocation.command === CliCommand.SEED || invocation.command === CliCommand.RESET_SEED) {
      logger.log('Seeding master data...');
      const masterData = await seedService.seedMasterDataAsync();
      logger.log(
        `Master data seeded: ${masterData.userIds.length} users, ` +
          `${masterData.exerciseIds.length} exercises, ` +
          `${masterData.muscleGroupIds.length} muscle groups, ` +
          `${masterData.mappingCount} mappings.`,
      );

      const userId = invocation.userId ?? masterData.demoUserId;
      logger.log(
        `Seeding ${invocation.count} workout entries for user ${userId} ` +
          `(batch size ${invocation.batchSize})...`,
      );
      await seedService.seedWorkoutsAsync({
        userId,
        count: invocation.count,
        batchSize: invocation.batchSize,
      });
      logger.log('Workout dataset seeded.');
    }

    logger.log(`Done in ${((Date.now() - startedAt) / 1_000).toFixed(1)}s.`);
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  new Logger('DatabaseCli').error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
