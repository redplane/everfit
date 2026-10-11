import { Inject, Injectable } from '@nestjs/common';
import { IPersonalRecordComparisonService } from './personal-record-comparison-service.interface';
import { GetPersonalRecordComparisonQueryDto } from '../../dto/get-personal-record-comparison-query.dto';
import { PersonalRecordComparisonDto } from '../../dto/personal-record-comparison.dto';
import { PersonalRecordPeriodDto } from '../../dto/personal-record-period.dto';
import { PersonalRecordMetricDto } from '../../dto/personal-record-metric.dto';
import { PersonalRecordDeltaDto } from '../../dto/personal-record-delta.dto';
import { PersonalRecordComparisonDeltaDto } from '../../dto/personal-record-comparison-delta.dto';
import { IUserService } from '../../../../cores/user/services/user/user-service.interface';
import { UserServiceInjectionTokens } from '../../../../cores/user/services/user/user-injection-tokens';
import { UserByIdNotFoundException } from '../../../../cores/user/exceptions/user-by-id-not-found.exception';
import { IExerciseService } from '../../../../cores/exercise/services/exercise/exercise-service.interface';
import { ExerciseServiceInjectionTokens } from '../../../../cores/exercise/services/exercise/exercise-injection-tokens';
import { ExerciseByIdNotFoundException } from '../../../../cores/exercise/exceptions/exercise-by-id-not-found.exception';
import { IScaleUnitConversionService } from '../../../../cores/scale-unit/services/scale-unit-conversion/scale-unit-conversion-service.interface';
import { ScaleUnitConversionServiceInjectionTokens } from '../../../../cores/scale-unit/services/scale-unit-conversion/scale-unit-conversion-injection-tokens';
import { IWorkoutService } from '../../../../cores/workout/services/workout/workout-service.interface';
import { WorkoutServiceInjectionTokens } from '../../../../cores/workout/services/workout/workout-injection-tokens';
import { ITimeContext } from '../../../../../common/time-context/time-context.interface';
import { TimeContextInjectionTokens } from '../../../../../common/time-context/time-context-injection-tokens';
import { computePeriodComparisonWindows } from '../../../../../common/periods/period-boundary';
import { PeriodWindow } from '../../../../../models/periods/period-window';
import {
  PersonalRecordAggregate,
  PersonalRecordWinner,
} from '../../../../../models/results/personal-record-aggregate';
import { PersonalRecordDeltaDirection } from '../../../../../models/results/personal-record-delta-direction';

@Injectable()
export class PersonalRecordComparisonService implements IPersonalRecordComparisonService {
  //#region Constructor
  public constructor(
    @Inject(UserServiceInjectionTokens.SERVICE__USER)
    private readonly __userService: IUserService,
    @Inject(ExerciseServiceInjectionTokens.SERVICE__EXERCISE)
    private readonly __exerciseService: IExerciseService,
    @Inject(ScaleUnitConversionServiceInjectionTokens.SERVICE__SCALE_UNIT_CONVERSION)
    private readonly __scaleUnitConversionService: IScaleUnitConversionService,
    @Inject(WorkoutServiceInjectionTokens.SERVICE__WORKOUT)
    private readonly __workoutService: IWorkoutService,
    @Inject(TimeContextInjectionTokens.CONTEXT__TIME)
    private readonly __timeContext: ITimeContext,
  ) {}
  //#endregion

  //#region Methods
  public async compareAsync(
    query: GetPersonalRecordComparisonQueryDto,
  ): Promise<PersonalRecordComparisonDto> {
    // 4a. Domain check — the user must exist.
    const userExists = await this.__userService.existsByIdAsync(query.userId);
    if (!userExists) {
      throw new UserByIdNotFoundException(query.userId);
    }

    // 4b. Domain check — the exercise must exist (checked before any aggregation).
    const exerciseExists = await this.__exerciseService.existsByIdAsync(query.exerciseId);
    if (!exerciseExists) {
      throw new ExerciseByIdNotFoundException(query.exerciseId);
    }

    // 4c. Derive the current + previous windows from the injected clock, in the caller's timezone.
    const now = await this.__timeContext.getUtcNowAsync();
    const { current, previous } = computePeriodComparisonWindows(
      now,
      query.granularity,
      query.timezone,
    );

    // 5. Aggregate both windows (Task 7 aggregation) concurrently.
    const [currentAggregate, previousAggregate] = await Promise.all([
      this.__workoutService.getPersonalRecordsAsync({
        userId: query.userId,
        exerciseId: query.exerciseId,
        from: current.start,
        to: current.end,
      }),
      this.__workoutService.getPersonalRecordsAsync({
        userId: query.userId,
        exerciseId: query.exerciseId,
        from: previous.start,
        to: previous.end,
      }),
    ]);

    const [currentBlock, previousBlock] = await Promise.all([
      this.__toPeriodAsync(current, currentAggregate, query.unit),
      this.__toPeriodAsync(previous, previousAggregate, query.unit),
    ]);

    const delta = await this.__computeDeltaBlockAsync(
      currentAggregate,
      previousAggregate,
      query.unit,
    );

    return new PersonalRecordComparisonDto(
      query.userId,
      query.exerciseId,
      query.granularity,
      query.timezone,
      query.unit,
      currentBlock,
      previousBlock,
      delta,
    );
  }
  //#endregion

  //#region Helpers
  /** Builds one period block: the UTC window boundaries + the three metrics in the requested unit. */
  private async __toPeriodAsync(
    window: PeriodWindow,
    aggregate: PersonalRecordAggregate,
    unit: string,
  ): Promise<PersonalRecordPeriodDto> {
    const [maxWeight, maxVolume, best1Rm] = await Promise.all([
      this.__toMetricAsync(aggregate.maxWeight, unit),
      this.__toMetricAsync(aggregate.maxVolume, unit),
      this.__toMetricAsync(aggregate.best1Rm, unit),
    ]);

    return new PersonalRecordPeriodDto(window.start, window.end, maxWeight, maxVolume, best1Rm);
  }

  /**
   * Maps a kg-valued winning row to a response metric in the requested unit (null stays null). Each
   * weight-scaled value (`weightKg`, and `volumeKg`/`oneRepMaxKg` where present) is converted via
   * `fromBaseAsync` (2 dp); `reps` and `achievedAt` pass through unchanged.
   */
  private async __toMetricAsync(
    winner: PersonalRecordWinner | null,
    unit: string,
  ): Promise<PersonalRecordMetricDto | null> {
    if (winner === null) {
      return null;
    }

    const weight = await this.__scaleUnitConversionService.fromBaseAsync(winner.weightKg, unit);

    const volume =
      winner.volumeKg === undefined
        ? undefined
        : await this.__scaleUnitConversionService.fromBaseAsync(winner.volumeKg, unit);

    const oneRepMax =
      winner.oneRepMaxKg === undefined
        ? undefined
        : await this.__scaleUnitConversionService.fromBaseAsync(winner.oneRepMaxKg, unit);

    return new PersonalRecordMetricDto(weight, winner.reps, winner.achievedAt, volume, oneRepMax);
  }

  /** Builds the three per-metric deltas from the current/previous aggregates (headline kg scalars). */
  private async __computeDeltaBlockAsync(
    currentAggregate: PersonalRecordAggregate,
    previousAggregate: PersonalRecordAggregate,
    unit: string,
  ): Promise<PersonalRecordComparisonDeltaDto> {
    const [maxWeight, maxVolume, best1Rm] = await Promise.all([
      this.__computeDeltaAsync(
        this.__headlineKg(currentAggregate.maxWeight, 'weightKg'),
        this.__headlineKg(previousAggregate.maxWeight, 'weightKg'),
        unit,
      ),
      this.__computeDeltaAsync(
        this.__headlineKg(currentAggregate.maxVolume, 'volumeKg'),
        this.__headlineKg(previousAggregate.maxVolume, 'volumeKg'),
        unit,
      ),
      this.__computeDeltaAsync(
        this.__headlineKg(currentAggregate.best1Rm, 'oneRepMaxKg'),
        this.__headlineKg(previousAggregate.best1Rm, 'oneRepMaxKg'),
        unit,
      ),
    ]);

    return new PersonalRecordComparisonDeltaDto(maxWeight, maxVolume, best1Rm);
  }

  /**
   * Returns the metric's headline kg scalar for the delta (`weightKg` for max-weight, `volumeKg` for
   * max-volume, `oneRepMaxKg` for best-1RM), or `null` when the metric is absent.
   */
  private __headlineKg(
    winner: PersonalRecordWinner | null,
    field: 'weightKg' | 'volumeKg' | 'oneRepMaxKg',
  ): number | null {
    if (winner === null) {
      return null;
    }

    return winner[field] ?? null;
  }

  /**
   * Computes one metric delta on kg, converting the absolute to the requested unit for display.
   * - both null → `same` (null absolute/percent).
   * - previous null, current present → `new` (null absolute/percent; no divide-by-zero).
   * - current null, previous present → `none` (null absolute/percent).
   * - both present → `up`/`down`/`same` by the sign of (current − previous); percent on kg (2 dp).
   */
  private async __computeDeltaAsync(
    currentKg: number | null,
    previousKg: number | null,
    unit: string,
  ): Promise<PersonalRecordDeltaDto> {
    if (currentKg === null && previousKg === null) {
      return new PersonalRecordDeltaDto(null, null, PersonalRecordDeltaDirection.SAME);
    }

    if (previousKg === null) {
      return new PersonalRecordDeltaDto(null, null, PersonalRecordDeltaDirection.NEW);
    }

    if (currentKg === null) {
      return new PersonalRecordDeltaDto(null, null, PersonalRecordDeltaDirection.NONE);
    }

    const absoluteKg = currentKg - previousKg;

    let direction: PersonalRecordDeltaDirection;
    if (absoluteKg > 0) {
      direction = PersonalRecordDeltaDirection.UP;
    } else if (absoluteKg < 0) {
      direction = PersonalRecordDeltaDirection.DOWN;
    } else {
      direction = PersonalRecordDeltaDirection.SAME;
    }

    const percent =
      previousKg === 0 ? null : Math.round((absoluteKg / previousKg) * 100 * 100) / 100;
    const absolute = await this.__scaleUnitConversionService.fromBaseAsync(absoluteKg, unit);

    return new PersonalRecordDeltaDto(absolute, percent, direction);
  }
  //#endregion
}
