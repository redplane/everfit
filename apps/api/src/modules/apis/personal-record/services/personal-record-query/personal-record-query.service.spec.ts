import { PersonalRecordQueryService } from './personal-record-query.service';
import { GetPersonalRecordQueryDto } from '../../dto/get-personal-record-query.dto';
import { IUserService } from '../../../../cores/user/services/user/user-service.interface';
import { UserByIdNotFoundException } from '../../../../cores/user/exceptions/user-by-id-not-found.exception';
import { IExerciseService } from '../../../../cores/exercise/services/exercise/exercise-service.interface';
import { ExerciseByIdNotFoundException } from '../../../../cores/exercise/exceptions/exercise-by-id-not-found.exception';
import { IScaleUnitConversionService } from '../../../../cores/scale-unit/services/scale-unit-conversion/scale-unit-conversion-service.interface';
import { IWorkoutService } from '../../../../cores/workout/services/workout/workout-service.interface';
import { PersonalRecordAggregate } from '../../../../../models/results/personal-record-aggregate';

const USER_ID = '018f6b0a-0000-7000-8000-000000000001';
const EXERCISE_ID = '018f6b0a-0000-7000-8000-0000000000a1';
const DAY_1 = new Date('2026-10-01T10:00:00.000Z');
const DAY_2 = new Date('2026-10-02T10:00:00.000Z');
const DAY_3 = new Date('2026-10-03T10:00:00.000Z');

class StubUserService implements Partial<IUserService> {
  public exists = true;
  public existsByIdAsync = jest.fn(() => Promise.resolve(this.exists));
}

class StubExerciseService implements Partial<IExerciseService> {
  public exists = true;
  public existsByIdAsync = jest.fn(() => Promise.resolve(this.exists));
}

class StubScaleUnitConversionService implements Partial<IScaleUnitConversionService> {
  // Deterministic display conversion: kg -> value; lb -> value / 0.45359237 (2 dp).
  public fromBaseAsync = jest.fn((valueBase: number, code: string) => {
    const converted = code === 'lb' ? valueBase / 0.45359237 : valueBase;
    return Promise.resolve(Math.round(converted * 100) / 100);
  });
}

class StubWorkoutService implements Partial<IWorkoutService> {
  public aggregate: PersonalRecordAggregate = { maxWeight: null, maxVolume: null, best1Rm: null };
  public getPersonalRecordsAsync = jest.fn(() => Promise.resolve(this.aggregate));
}

function fullAggregate(): PersonalRecordAggregate {
  return {
    maxWeight: { weightKg: 130, reps: 2, achievedAt: DAY_3 },
    maxVolume: { weightKg: 90, reps: 12, volumeKg: 1080, achievedAt: DAY_2 },
    best1Rm: { weightKg: 115, reps: 8, oneRepMaxKg: 145.67, achievedAt: DAY_1 },
  };
}

function query(overrides?: Partial<GetPersonalRecordQueryDto>): GetPersonalRecordQueryDto {
  return { userId: USER_ID, exerciseId: EXERCISE_ID, unit: 'kg', ...overrides };
}

describe('PersonalRecordQueryService', () => {
  let userService: StubUserService;
  let exerciseService: StubExerciseService;
  let conversionService: StubScaleUnitConversionService;
  let workoutService: StubWorkoutService;
  let service: PersonalRecordQueryService;

  beforeEach(() => {
    userService = new StubUserService();
    exerciseService = new StubExerciseService();
    conversionService = new StubScaleUnitConversionService();
    workoutService = new StubWorkoutService();
    service = new PersonalRecordQueryService(
      userService as unknown as IUserService,
      exerciseService as unknown as IExerciseService,
      conversionService as unknown as IScaleUnitConversionService,
      workoutService as unknown as IWorkoutService,
    );
  });

  //#region getAsync
  describe('getAsync', () => {
    it('builds the PersonalRecordDto with the scope, unit, and the three metrics (reps/dates pass through)', async () => {
      workoutService.aggregate = fullAggregate();

      const result = await service.getAsync(query());

      expect(result.userId).toBe(USER_ID);
      expect(result.exerciseId).toBe(EXERCISE_ID);
      expect(result.unit).toBe('kg');
      expect(result.maxWeight).toEqual({
        weight: 130,
        reps: 2,
        achievedAt: DAY_3,
        volume: undefined,
        oneRepMax: undefined,
      });
      expect(result.maxVolume?.reps).toBe(12);
      expect(result.maxVolume?.achievedAt).toEqual(DAY_2);
      expect(result.best1Rm?.reps).toBe(8);
      expect(result.best1Rm?.achievedAt).toEqual(DAY_1);
    });

    it('converts every weight-scaled value (weight, volume, oneRepMax) from kg to the requested unit', async () => {
      workoutService.aggregate = fullAggregate();

      const result = await service.getAsync(query({ unit: 'lb' }));

      // 130 kg -> 286.6 lb; volume 1080 kg -> 2380.99 lb; 1rm 145.67 kg -> 321.15 lb (2 dp).
      expect(result.maxWeight?.weight).toBeCloseTo(286.6, 1);
      expect(result.maxVolume?.volume).toBeCloseTo(2380.99, 1);
      expect(result.best1Rm?.oneRepMax).toBeCloseTo(321.15, 1);
      // Each weight-scaled value is routed through the kg->unit conversion.
      expect(conversionService.fromBaseAsync).toHaveBeenCalledWith(1080, 'lb');
      expect(conversionService.fromBaseAsync).toHaveBeenCalledWith(145.67, 'lb');
    });

    it('throws UserByIdNotFoundException (404) and does NOT aggregate when the user is unknown', async () => {
      userService.exists = false;

      await expect(service.getAsync(query())).rejects.toBeInstanceOf(UserByIdNotFoundException);
      expect(workoutService.getPersonalRecordsAsync).not.toHaveBeenCalled();
      expect(exerciseService.existsByIdAsync).not.toHaveBeenCalled();
    });

    it('throws ExerciseByIdNotFoundException (404) and does NOT aggregate when the exercise is unknown', async () => {
      exerciseService.exists = false;

      await expect(service.getAsync(query())).rejects.toBeInstanceOf(ExerciseByIdNotFoundException);
      expect(workoutService.getPersonalRecordsAsync).not.toHaveBeenCalled();
    });

    it('returns a dto with all-null metrics (not an error) when the known exercise has no sets', async () => {
      workoutService.aggregate = { maxWeight: null, maxVolume: null, best1Rm: null };

      const result = await service.getAsync(query());

      expect(result.maxWeight).toBeNull();
      expect(result.maxVolume).toBeNull();
      expect(result.best1Rm).toBeNull();
      // No conversion is attempted for null metrics.
      expect(conversionService.fromBaseAsync).not.toHaveBeenCalled();
    });

    it('converts each metric independently (a present metric alongside null metrics)', async () => {
      workoutService.aggregate = {
        maxWeight: { weightKg: 100, reps: 5, achievedAt: DAY_1 },
        maxVolume: null,
        best1Rm: null,
      };

      const result = await service.getAsync(query());

      expect(result.maxWeight?.weight).toBe(100);
      expect(result.maxVolume).toBeNull();
      expect(result.best1Rm).toBeNull();
    });
  });
  //#endregion
});
