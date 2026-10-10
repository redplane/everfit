import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, QueryFailedError, Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { IWorkoutService } from './workout-service.interface';
import { WorkoutEntryEntity } from '../../entities/workout-entry.entity';
import { WorkoutSetEntity } from '../../entities/workout-set.entity';
import { WorkoutSetAlreadyExistsException } from '../../exceptions/workout-set-already-exists.exception';
import { CreateWorkoutOptions } from '../../../../../models/options/create-workout-options';
import { WorkoutHistorySearchCriteria } from '../../../../../models/criteria/workout-history-search-criteria';
import { PersonalRecordCriteria } from '../../../../../models/criteria/personal-record-criteria';
import {
  PersonalRecordAggregate,
  PersonalRecordWinner,
} from '../../../../../models/results/personal-record-aggregate';
import { CursorPage } from '../../../../../common/models/cursor-page';
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
    @InjectRepository(WorkoutEntryEntity)
    private readonly __entryRepository: Repository<WorkoutEntryEntity>,
    @InjectRepository(WorkoutSetEntity)
    private readonly __setRepository: Repository<WorkoutSetEntity>,
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

  public async searchHistoryAsync(
    criteria: WorkoutHistorySearchCriteria,
  ): Promise<CursorPage<WorkoutEntryEntity>> {
    const query = this.__entryRepository
      .createQueryBuilder('entry')
      .where('entry.user_id = :userId', { userId: criteria.userId });

    if (criteria.exerciseIds !== undefined) {
      query.andWhere('entry.exercise_id IN (:...exerciseIds)', {
        exerciseIds: criteria.exerciseIds,
      });
    }

    if (criteria.from !== undefined) {
      query.andWhere('entry.performed_at >= :from', { from: criteria.from });
    }

    if (criteria.to !== undefined) {
      query.andWhere('entry.performed_at <= :to', { to: criteria.to });
    }

    if (criteria.cursor !== undefined) {
      // Expanded keyset predicate (NOT the row-value form `(a, b) < (p, c)`, which pg-mem cannot
      // parse) — semantically identical and index-eligible on real Postgres under
      // (user_id, performed_at DESC, id DESC).
      query.andWhere(
        '(entry.performed_at < :cursorPerformedAt OR ' +
          '(entry.performed_at = :cursorPerformedAt AND entry.id < :cursorId))',
        {
          cursorPerformedAt: criteria.cursor.performedAt,
          cursorId: criteria.cursor.id,
        },
      );
    }

    // Fetch one extra row to detect whether a further page exists.
    const rows = await query
      .orderBy('entry.performed_at', 'DESC')
      .addOrderBy('entry.id', 'DESC')
      .take(criteria.limit + 1)
      .getMany();

    const hasMore = rows.length > criteria.limit;
    const items = hasMore ? rows.slice(0, criteria.limit) : rows;

    await this.__attachSetsAsync(items);

    return { items, hasMore };
  }

  public async getPersonalRecordsAsync(
    criteria: PersonalRecordCriteria,
  ): Promise<PersonalRecordAggregate> {
    // Three independent top-1 index scans — each driven by its own expression/descending index on
    // (user_id, exercise_id, <metric> DESC). Run concurrently; each is O(log n) at 50k+.
    const [maxWeightRow, maxVolumeRow, best1RmRow] = await Promise.all([
      this.__topSetByAsync(criteria, 's.weight_kg'),
      this.__topSetByAsync(criteria, '(s.reps * s.weight_kg)'),
      this.__topSetByAsync(criteria, '(s.weight_kg * (1 + s.reps / 30.0))'),
    ]);

    return {
      maxWeight: this.__toWinner(maxWeightRow),
      maxVolume: this.__toWinner(maxVolumeRow, (row) => ({ volumeKg: row.reps * row.weightKg })),
      best1Rm: this.__toWinner(best1RmRow, (row) => ({
        // Epley: weight × (1 + reps / 30).
        oneRepMaxKg: row.weightKg * (1 + row.reps / 30),
      })),
    };
  }
  //#endregion

  //#region Helpers
  /**
   * Runs one top-1 read for a PR metric: filters by `(user_id, exercise_id)` (plus the optional
   * half-open `performed_at` range for F8), orders by the metric `DESC` then `performed_at ASC,
   * id ASC` (earliest achievement wins ties deterministically), and takes a single row. The
   * `metricExpression` is written to match the corresponding index expression exactly so Postgres can
   * serve it as an index scan. Returns `null` when no set matches.
   */
  private async __topSetByAsync(
    criteria: PersonalRecordCriteria,
    metricExpression: string,
  ): Promise<WorkoutSetEntity | null> {
    const query = this.__setRepository
      .createQueryBuilder('s')
      .where('s.user_id = :userId', { userId: criteria.userId })
      .andWhere('s.exercise_id = :exerciseId', { exerciseId: criteria.exerciseId });

    if (criteria.from !== undefined) {
      query.andWhere('s.performed_at >= :from', { from: criteria.from });
    }

    if (criteria.to !== undefined) {
      // Half-open upper bound [from, to) (F8 period boundaries).
      query.andWhere('s.performed_at < :to', { to: criteria.to });
    }

    return query
      .orderBy(metricExpression, 'DESC')
      .addOrderBy('s.performed_at', 'ASC')
      .addOrderBy('s.id', 'ASC')
      .limit(1)
      .getOne();
  }

  /**
   * Maps a winning set row to a `PersonalRecordWinner` in kg (or `null` when there is no row). The
   * optional `derive` callback adds the metric-specific derived value (`volumeKg` / `oneRepMaxKg`).
   */
  private __toWinner(
    row: WorkoutSetEntity | null,
    derive?: (row: WorkoutSetEntity) => Partial<PersonalRecordWinner>,
  ): PersonalRecordWinner | null {
    if (row === null) {
      return null;
    }

    return {
      weightKg: row.weightKg,
      reps: row.reps,
      achievedAt: row.performedAt,
      ...(derive ? derive(row) : {}),
    };
  }

  /**
   * Loads the sets for a page of entries in one query (no N+1) and attaches them, ordered
   * `set_number ASC` so the response lists sets in their logged order.
   */
  private async __attachSetsAsync(entries: WorkoutEntryEntity[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    const entryIds = entries.map((entry) => entry.id);
    const sets = await this.__setRepository.find({
      where: { workoutEntryId: In(entryIds) },
      order: { setNumber: 'ASC' },
    });

    for (const entry of entries) {
      entry.sets = sets.filter((set) => set.workoutEntryId === entry.id);
    }
  }

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
