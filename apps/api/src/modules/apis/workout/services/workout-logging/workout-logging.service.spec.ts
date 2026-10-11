import { WorkoutLoggingService } from './workout-logging.service';
import { CreateWorkoutPayloadDto } from '../../dto/create-workout-payload.dto';
import { IUserService } from '../../../../cores/user/services/user/user-service.interface';
import { UserByIdNotFoundException } from '../../../../cores/user/exceptions/user-by-id-not-found.exception';
import { IExerciseService } from '../../../../cores/exercise/services/exercise/exercise-service.interface';
import { ExerciseByIdNotFoundException } from '../../../../cores/exercise/exceptions/exercise-by-id-not-found.exception';
import { IScaleUnitConversionService } from '../../../../cores/scale-unit/services/scale-unit-conversion/scale-unit-conversion-service.interface';
import { UnsupportedScaleUnitException } from '../../../../cores/scale-unit/exceptions/unsupported-scale-unit.exception';
import { IWorkoutService } from '../../../../cores/workout/services/workout/workout-service.interface';
import { WorkoutSetAlreadyExistsException } from '../../../../cores/workout/exceptions/workout-set-already-exists.exception';
import { WorkoutEntryEntity } from '../../../../cores/workout/entities/workout-entry.entity';
import { CreateWorkoutOptions } from '../../../../../models/options/create-workout-options';

const USER_ID = '018f6b0a-0000-7000-8000-000000000001';
const EXERCISE_A = '018f6b0a-0000-7000-8000-0000000000a1';
const EXERCISE_B = '018f6b0a-0000-7000-8000-0000000000b1';

class StubUserService implements IUserService {
  public exists = true;
  public getByIdAsync = jest.fn();
  public existsByIdAsync = jest.fn(() => Promise.resolve(this.exists));
  public searchAsync = jest.fn();
  public createAsync = jest.fn();
}

class StubExerciseService implements Partial<IExerciseService> {
  public missingIds = new Set<string>();
  public existsByIdAsync = jest.fn((id: string) => Promise.resolve(!this.missingIds.has(id)));
}

class StubScaleUnitConversionService implements Partial<IScaleUnitConversionService> {
  public unsupportedUnits = new Set<string>();
  // Deterministic "conversion": kg -> x1, lb -> x0.45359237.
  public toBaseAsync = jest.fn((value: number, code: string) => {
    if (this.unsupportedUnits.has(code)) {
      return Promise.reject(new UnsupportedScaleUnitException(code));
    }
    const factor = code === 'lb' ? 0.45359237 : 1;
    return Promise.resolve(value * factor);
  });
}

class StubWorkoutService implements IWorkoutService {
  public lastOptions!: CreateWorkoutOptions;
  public error?: Error;
  // History / PR reads are unused by the logging service; present only to satisfy the interface.
  public searchHistoryAsync = jest.fn();
  public getPersonalRecordsAsync = jest.fn();
  public createManyAsync = jest.fn((options: CreateWorkoutOptions) => {
    this.lastOptions = options;
    if (this.error) {
      return Promise.reject(this.error);
    }
    return Promise.resolve(
      options.entries.map(
        (entry) =>
          new WorkoutEntryEntity('id', options.userId, entry.exerciseId, entry.performedAt, new Date()),
      ),
    );
  });
}

function payload(overrides?: Partial<CreateWorkoutPayloadDto>): CreateWorkoutPayloadDto {
  return {
    userId: USER_ID,
    entries: [
      {
        exerciseId: EXERCISE_A,
        performedAt: '2026-10-09T18:00:00.000Z',
        sets: [{ reps: 8, weight: 100, unit: 'kg' }],
      },
    ],
    ...overrides,
  };
}

describe('WorkoutLoggingService', () => {
  let userService: StubUserService;
  let exerciseService: StubExerciseService;
  let scaleUnitService: StubScaleUnitConversionService;
  let workoutService: StubWorkoutService;
  let service: WorkoutLoggingService;

  beforeEach(() => {
    userService = new StubUserService();
    exerciseService = new StubExerciseService();
    scaleUnitService = new StubScaleUnitConversionService();
    workoutService = new StubWorkoutService();
    service = new WorkoutLoggingService(
      userService,
      exerciseService as unknown as IExerciseService,
      scaleUnitService as unknown as IScaleUnitConversionService,
      workoutService,
    );
  });

  //#region logAsync
  describe('logAsync', () => {
    it('logs a single entry: checks user+exercise, normalizes to kg, assigns set_number, persists', async () => {
      await service.logAsync(payload());

      expect(userService.existsByIdAsync).toHaveBeenCalledWith(USER_ID);
      expect(exerciseService.existsByIdAsync).toHaveBeenCalledWith(EXERCISE_A);
      expect(workoutService.createManyAsync).toHaveBeenCalledTimes(1);
      const options = workoutService.lastOptions;
      expect(options.userId).toBe(USER_ID);
      expect(options.entries[0].performedAt).toEqual(new Date('2026-10-09T18:00:00.000Z'));
      expect(options.entries[0].sets[0]).toEqual({
        setNumber: 1,
        reps: 8,
        weight: 100,
        unit: 'kg',
        weightKg: 100,
      });
    });

    it('logs a bulk multi-exercise payload, checking each exercise once', async () => {
      await service.logAsync(
        payload({
          entries: [
            {
              exerciseId: EXERCISE_A,
              performedAt: '2026-10-09T18:00:00.000Z',
              sets: [{ reps: 5, weight: 60, unit: 'kg' }],
            },
            {
              exerciseId: EXERCISE_B,
              performedAt: '2026-10-09T18:30:00.000Z',
              sets: [{ reps: 10, weight: 40, unit: 'kg' }],
            },
          ],
        }),
      );

      expect(exerciseService.existsByIdAsync).toHaveBeenCalledWith(EXERCISE_A);
      expect(exerciseService.existsByIdAsync).toHaveBeenCalledWith(EXERCISE_B);
      expect(workoutService.lastOptions.entries).toHaveLength(2);
    });

    it('checks a repeated exercise id only once (distinct ids)', async () => {
      await service.logAsync(
        payload({
          entries: [
            {
              exerciseId: EXERCISE_A,
              performedAt: '2026-10-09T18:00:00.000Z',
              sets: [{ reps: 5, weight: 60, unit: 'kg' }],
            },
            {
              exerciseId: EXERCISE_A,
              performedAt: '2026-10-09T19:00:00.000Z',
              sets: [{ reps: 5, weight: 60, unit: 'kg' }],
            },
          ],
        }),
      );

      expect(exerciseService.existsByIdAsync).toHaveBeenCalledTimes(1);
    });

    it('normalizes lb weights to kg (uses the conversion result as weightKg, preserving original)', async () => {
      await service.logAsync(
        payload({
          entries: [
            {
              exerciseId: EXERCISE_A,
              performedAt: '2026-10-09T18:00:00.000Z',
              sets: [{ reps: 8, weight: 100, unit: 'lb' }],
            },
          ],
        }),
      );

      const set = workoutService.lastOptions.entries[0].sets[0];
      expect(set.unit).toBe('lb');
      expect(set.weight).toBe(100);
      expect(set.weightKg).toBeCloseTo(45.359237, 6);
    });

    it('assigns a 1-based set_number restarting per entry', async () => {
      await service.logAsync(
        payload({
          entries: [
            {
              exerciseId: EXERCISE_A,
              performedAt: '2026-10-09T18:00:00.000Z',
              sets: [
                { reps: 8, weight: 100, unit: 'kg' },
                { reps: 6, weight: 110, unit: 'kg' },
              ],
            },
            {
              exerciseId: EXERCISE_B,
              performedAt: '2026-10-09T18:30:00.000Z',
              sets: [
                { reps: 10, weight: 40, unit: 'kg' },
                { reps: 10, weight: 40, unit: 'kg' },
              ],
            },
          ],
        }),
      );

      const entries = workoutService.lastOptions.entries;
      expect(entries[0].sets.map((s) => s.setNumber)).toEqual([1, 2]);
      expect(entries[1].sets.map((s) => s.setNumber)).toEqual([1, 2]);
    });

    it('throws UserByIdNotFoundException and does not write when the user does not exist', async () => {
      userService.exists = false;

      await expect(service.logAsync(payload())).rejects.toBeInstanceOf(UserByIdNotFoundException);
      expect(workoutService.createManyAsync).not.toHaveBeenCalled();
    });

    it('throws ExerciseByIdNotFoundException and does not write when any exercise is unknown', async () => {
      exerciseService.missingIds.add(EXERCISE_B);

      await expect(
        service.logAsync(
          payload({
            entries: [
              {
                exerciseId: EXERCISE_A,
                performedAt: '2026-10-09T18:00:00.000Z',
                sets: [{ reps: 5, weight: 60, unit: 'kg' }],
              },
              {
                exerciseId: EXERCISE_B,
                performedAt: '2026-10-09T18:30:00.000Z',
                sets: [{ reps: 10, weight: 40, unit: 'kg' }],
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(ExerciseByIdNotFoundException);
      expect(workoutService.createManyAsync).not.toHaveBeenCalled();
    });

    it('propagates UnsupportedScaleUnitException from toBaseAsync and does not write', async () => {
      scaleUnitService.unsupportedUnits.add('stone');

      await expect(
        service.logAsync(
          payload({
            entries: [
              {
                exerciseId: EXERCISE_A,
                performedAt: '2026-10-09T18:00:00.000Z',
                sets: [{ reps: 8, weight: 100, unit: 'stone' }],
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(UnsupportedScaleUnitException);
      expect(workoutService.createManyAsync).not.toHaveBeenCalled();
    });

    it('propagates WorkoutSetAlreadyExistsException from the core service unchanged', async () => {
      workoutService.error = new WorkoutSetAlreadyExistsException();

      await expect(service.logAsync(payload())).rejects.toBeInstanceOf(
        WorkoutSetAlreadyExistsException,
      );
    });
  });
  //#endregion
});
