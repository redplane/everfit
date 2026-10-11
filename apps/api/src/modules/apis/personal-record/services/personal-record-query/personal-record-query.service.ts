import { Inject, Injectable } from '@nestjs/common';
import { IPersonalRecordQueryService } from './personal-record-query-service.interface';
import { GetPersonalRecordQueryDto } from '../../dto/get-personal-record-query.dto';
import { PersonalRecordDto } from '../../dto/personal-record.dto';
import { PersonalRecordMetricDto } from '../../dto/personal-record-metric.dto';
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
import { PersonalRecordWinner } from '../../../../../models/results/personal-record-aggregate';

@Injectable()
export class PersonalRecordQueryService implements IPersonalRecordQueryService {
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
  ) {}
  //#endregion

  //#region Methods
  public async getAsync(query: GetPersonalRecordQueryDto): Promise<PersonalRecordDto> {
    // 4a. Domain check — the user must exist.
    const userExists = await this.__userService.existsByIdAsync(query.userId);
    if (!userExists) {
      throw new UserByIdNotFoundException(query.userId);
    }

    // 4b. Domain check — the exercise must exist (unknown exercise → 404, distinct from a known
    // exercise with no sets which yields null metrics).
    const exerciseExists = await this.__exerciseService.existsByIdAsync(query.exerciseId);
    if (!exerciseExists) {
      throw new ExerciseByIdNotFoundException(query.exerciseId);
    }

    // 5. Index-backed PR aggregation (kg), then convert weight-scaled values to the requested unit.
    const aggregate = await this.__workoutService.getPersonalRecordsAsync({
      userId: query.userId,
      exerciseId: query.exerciseId,
    });

    const [maxWeight, maxVolume, best1Rm] = await Promise.all([
      this.__toMetricAsync(aggregate.maxWeight, query.unit),
      this.__toMetricAsync(aggregate.maxVolume, query.unit),
      this.__toMetricAsync(aggregate.best1Rm, query.unit),
    ]);

    return new PersonalRecordDto(
      query.userId,
      query.exerciseId,
      query.unit,
      maxWeight,
      maxVolume,
      best1Rm,
    );
  }
  //#endregion

  //#region Helpers
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
  //#endregion
}
