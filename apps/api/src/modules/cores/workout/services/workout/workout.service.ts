import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { IWorkoutService } from './workout-service.interface';
import { WorkoutEntryEntity } from '../../entities/workout-entry.entity';
import { WorkoutSetEntity } from '../../entities/workout-set.entity';
import { WorkoutSetAlreadyExistsException } from '../../exceptions/workout-set-already-exists.exception';
import { CreateWorkoutOptions } from '../../../../../models/options/create-workout-options';
import { ITimeContext } from '../../../../../common/time-context/time-context.interface';
import { TimeContextInjectionTokens } from '../../../../../common/time-context/time-context-injection-tokens';

/** Postgres SQLSTATE for a unique-constraint violation. */
const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class WorkoutService implements IWorkoutService {
  //#region Constructor
  public constructor(
    @InjectDataSource()
    private readonly __dataSource: DataSource,
    @Inject(TimeContextInjectionTokens.CONTEXT__TIME)
    private readonly __timeContext: ITimeContext,
  ) {}
  //#endregion

  //#region Methods
  public async createManyAsync(options: CreateWorkoutOptions): Promise<WorkoutEntryEntity[]> {
    const now = await this.__timeContext.getUtcNowAsync();

    try {
      // One transaction wraps the ENTIRE batch (all entries, all sets): any throw inside aborts it
      // and nothing is written (all-or-nothing, §8).
      return await this.__dataSource.transaction((manager) =>
        this.__persistBatchAsync(manager, options, now),
      );
    } catch (error) {
      if (this.__isUniqueViolation(error)) {
        throw new WorkoutSetAlreadyExistsException();
      }

      throw error;
    }
  }
  //#endregion

  //#region Helpers
  private async __persistBatchAsync(
    manager: EntityManager,
    options: CreateWorkoutOptions,
    now: Date,
  ): Promise<WorkoutEntryEntity[]> {
    const entryRepository = manager.getRepository(WorkoutEntryEntity);
    const setRepository = manager.getRepository(WorkoutSetEntity);
    const persisted: WorkoutEntryEntity[] = [];

    for (const entryOption of options.entries) {
      const entry = new WorkoutEntryEntity(
        uuidv7(),
        options.userId,
        entryOption.exerciseId,
        entryOption.performedAt,
        now,
      );
      await entryRepository.save(entry);

      const sets: WorkoutSetEntity[] = [];
      for (const setOption of entryOption.sets) {
        const set = new WorkoutSetEntity(
          uuidv7(),
          entry.id,
          options.userId,
          entryOption.exerciseId,
          entryOption.performedAt,
          setOption.setNumber,
          setOption.reps,
          setOption.weight,
          setOption.unit,
          setOption.weightKg,
          now,
        );
        await setRepository.save(set);
        sets.push(set);
      }

      entry.sets = sets;
      persisted.push(entry);
    }

    return persisted;
  }

  /**
   * Whether the error is a Postgres unique-constraint violation (SQLSTATE 23505), checked across the
   * shapes TypeORM / the driver can surface it in.
   */
  private __isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as { code?: string } | undefined;

    return (
      (error as unknown as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION ||
      driverError?.code === POSTGRES_UNIQUE_VIOLATION
    );
  }
  //#endregion
}
