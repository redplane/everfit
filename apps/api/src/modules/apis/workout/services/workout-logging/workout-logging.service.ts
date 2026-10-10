import { Inject, Injectable } from '@nestjs/common';
import { IWorkoutLoggingService } from './workout-logging-service.interface';
import { CreateWorkoutPayloadDto } from '../../dto/create-workout-payload.dto';
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
import { WorkoutEntryEntity } from '../../../../cores/workout/entities/workout-entry.entity';
import { CreateWorkoutOptions } from '../../../../../models/options/create-workout-options';
import { CreateWorkoutEntryOption } from '../../../../../models/options/create-workout-entry-option';
import { CreateWorkoutSetOption } from '../../../../../models/options/create-workout-set-option';

@Injectable()
export class WorkoutLoggingService implements IWorkoutLoggingService {
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
  public async logAsync(payload: CreateWorkoutPayloadDto): Promise<WorkoutEntryEntity[]> {
    // 4a. Domain check — the user must exist. Rejects the whole request before any write.
    const userExists = await this.__userService.existsByIdAsync(payload.userId);
    if (!userExists) {
      throw new UserByIdNotFoundException(payload.userId);
    }

    // 4b. Domain check — every referenced exercise must exist. Any unknown exercise rejects the whole
    // batch (checked once per distinct id to avoid redundant lookups).
    await this.__ensureExercisesExistAsync(payload);

    // 4c. Normalize each set to kg and assign a 1-based set_number per entry.
    const entries: CreateWorkoutEntryOption[] = [];
    for (const entryPayload of payload.entries) {
      const sets: CreateWorkoutSetOption[] = [];
      for (let index = 0; index < entryPayload.sets.length; index++) {
        const setPayload = entryPayload.sets[index];
        const weightKg = await this.__scaleUnitConversionService.toBaseAsync(
          setPayload.weight,
          setPayload.unit,
        );
        sets.push({
          setNumber: index + 1,
          reps: setPayload.reps,
          weight: setPayload.weight,
          unit: setPayload.unit,
          weightKg,
        });
      }

      entries.push({
        exerciseId: entryPayload.exerciseId,
        performedAt: new Date(entryPayload.performedAt),
        sets,
      });
    }

    const options: CreateWorkoutOptions = { userId: payload.userId, entries };

    // 5. Persist the whole batch in one all-or-nothing transaction.
    return this.__workoutService.createManyAsync(options);
  }
  //#endregion

  //#region Helpers
  private async __ensureExercisesExistAsync(payload: CreateWorkoutPayloadDto): Promise<void> {
    const distinctExerciseIds = [...new Set(payload.entries.map((entry) => entry.exerciseId))];

    for (const exerciseId of distinctExerciseIds) {
      const exists = await this.__exerciseService.existsByIdAsync(exerciseId);
      if (!exists) {
        throw new ExerciseByIdNotFoundException(exerciseId);
      }
    }
  }
  //#endregion
}
