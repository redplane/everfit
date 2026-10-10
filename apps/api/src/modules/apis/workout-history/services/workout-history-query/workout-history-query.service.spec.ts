import { WorkoutHistoryQueryService } from './workout-history-query.service';
import { encodeCursor } from './workout-history-cursor.codec';
import { GetWorkoutHistoryQueryDto } from '../../dto/get-workout-history-query.dto';
import { IUserService } from '../../../../cores/user/services/user/user-service.interface';
import { UserByIdNotFoundException } from '../../../../cores/user/exceptions/user-by-id-not-found.exception';
import { IExerciseService } from '../../../../cores/exercise/services/exercise/exercise-service.interface';
import { ExerciseEntity } from '../../../../cores/exercise/entities/exercise.entity';
import { IScaleUnitConversionService } from '../../../../cores/scale-unit/services/scale-unit-conversion/scale-unit-conversion-service.interface';
import { IWorkoutService } from '../../../../cores/workout/services/workout/workout-service.interface';
import { WorkoutEntryEntity } from '../../../../cores/workout/entities/workout-entry.entity';
import { WorkoutSetEntity } from '../../../../cores/workout/entities/workout-set.entity';
import { WorkoutHistorySearchCriteria } from '../../../../../models/criteria/workout-history-search-criteria';
import { CursorPage } from '../../../../../common/models/cursor-page';
import { ValidationException } from '../../../../../common/exceptions/validation.exception';

const USER_ID = '018f6b0a-0000-7000-8000-000000000001';
const EXERCISE_A = '018f6b0a-0000-7000-8000-0000000000a1';
const EXERCISE_B = '018f6b0a-0000-7000-8000-0000000000b1';
const ENTRY_1 = '018f6b0a-0000-7000-8000-000000000011';
const ENTRY_2 = '018f6b0a-0000-7000-8000-000000000012';
const MUSCLE_GROUP_ID = '018f6b0a-0000-7000-8000-0000000000c1';
const DAY_1 = new Date('2026-10-01T10:00:00.000Z');
const DAY_2 = new Date('2026-10-02T10:00:00.000Z');

class StubUserService implements Partial<IUserService> {
  public exists = true;
  public existsByIdAsync = jest.fn(() => Promise.resolve(this.exists));
}

class StubExerciseService implements Partial<IExerciseService> {
  public nameIds: string[] = [];
  public muscleGroupIds: string[] = [];
  public resolveIdsByNameLikeAsync = jest.fn(() => Promise.resolve(this.nameIds));
  public resolveIdsByMuscleGroupIdAsync = jest.fn(() => Promise.resolve(this.muscleGroupIds));
  public getByIdsAsync = jest.fn((ids: string[]) =>
    Promise.resolve(
      ids.map((id) => new ExerciseEntity(id, `Exercise ${id.slice(-2)}`, new Date())),
    ),
  );
}

class StubScaleUnitConversionService implements Partial<IScaleUnitConversionService> {
  // Deterministic display conversion: kg -> value, lb -> value / 0.45359237 (2 dp).
  public fromBaseAsync = jest.fn((valueBase: number, code: string) => {
    const converted = code === 'lb' ? valueBase / 0.45359237 : valueBase;
    return Promise.resolve(Math.round(converted * 100) / 100);
  });
}

class StubWorkoutService implements Partial<IWorkoutService> {
  public page: CursorPage<WorkoutEntryEntity> = { items: [], hasMore: false };
  public lastCriteria?: WorkoutHistorySearchCriteria;
  public searchHistoryAsync = jest.fn((criteria: WorkoutHistorySearchCriteria) => {
    this.lastCriteria = criteria;
    return Promise.resolve(this.page);
  });
}

function entryWithSet(
  id: string,
  exerciseId: string,
  performedAt: Date,
  weightKg: number,
  originalWeight: number,
  originalUnit: string,
): WorkoutEntryEntity {
  const entry = new WorkoutEntryEntity(id, USER_ID, exerciseId, performedAt, new Date());
  entry.sets = [
    new WorkoutSetEntity(
      `${id}-s1`,
      id,
      USER_ID,
      exerciseId,
      performedAt,
      1,
      8,
      originalWeight,
      originalUnit,
      weightKg,
      new Date(),
    ),
  ];
  return entry;
}

function query(overrides?: Partial<GetWorkoutHistoryQueryDto>): GetWorkoutHistoryQueryDto {
  return {
    userId: USER_ID,
    unit: 'kg',
    limit: 20,
    ...overrides,
  } as GetWorkoutHistoryQueryDto;
}

describe('WorkoutHistoryQueryService', () => {
  let userService: StubUserService;
  let exerciseService: StubExerciseService;
  let scaleUnitService: StubScaleUnitConversionService;
  let workoutService: StubWorkoutService;
  let service: WorkoutHistoryQueryService;

  beforeEach(() => {
    userService = new StubUserService();
    exerciseService = new StubExerciseService();
    scaleUnitService = new StubScaleUnitConversionService();
    workoutService = new StubWorkoutService();
    service = new WorkoutHistoryQueryService(
      userService as unknown as IUserService,
      exerciseService as unknown as IExerciseService,
      scaleUnitService as unknown as IScaleUnitConversionService,
      workoutService as unknown as IWorkoutService,
    );
  });

  //#region searchAsync
  describe('searchAsync', () => {
    it('throws UserByIdNotFoundException when the user does not exist', async () => {
      userService.exists = false;

      await expect(service.searchAsync(query())).rejects.toBeInstanceOf(UserByIdNotFoundException);
      expect(workoutService.searchHistoryAsync).not.toHaveBeenCalled();
    });

    it('returns a SearchResult with weights converted to the requested unit and originals retained', async () => {
      workoutService.page = {
        items: [entryWithSet(ENTRY_1, EXERCISE_A, DAY_2, 100, 100, 'kg')],
        hasMore: false,
      };

      const result = await service.searchAsync(query({ unit: 'lb' }));

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.entryId).toBe(ENTRY_1);
      expect(item.exerciseName).toBe('Exercise a1');
      expect(item.unit).toBe('lb');
      // 100 kg -> ~220.46 lb (2 dp), original retained.
      expect(item.sets[0].weight).toBeCloseTo(220.46, 2);
      expect(item.sets[0].originalWeight).toBe(100);
      expect(item.sets[0].originalUnit).toBe('kg');
    });

    it('sets nextCursor when hasMore and null otherwise', async () => {
      workoutService.page = {
        items: [
          entryWithSet(ENTRY_2, EXERCISE_A, DAY_2, 100, 100, 'kg'),
          entryWithSet(ENTRY_1, EXERCISE_A, DAY_1, 100, 100, 'kg'),
        ],
        hasMore: true,
      };

      const result = await service.searchAsync(query());

      expect(result.nextCursor).toBe(encodeCursor({ performedAt: DAY_1, id: ENTRY_1 }));
    });

    it('returns null nextCursor at the last page', async () => {
      workoutService.page = {
        items: [entryWithSet(ENTRY_1, EXERCISE_A, DAY_1, 100, 100, 'kg')],
        hasMore: false,
      };

      const result = await service.searchAsync(query());

      expect(result.nextCursor).toBeNull();
    });

    it('resolves the partial-name filter to exercise ids passed to the core service', async () => {
      exerciseService.nameIds = [EXERCISE_A, EXERCISE_B];

      await service.searchAsync(query({ exerciseName: 'press' }));

      expect(exerciseService.resolveIdsByNameLikeAsync).toHaveBeenCalledWith('press');
      expect(workoutService.lastCriteria?.exerciseIds).toEqual([EXERCISE_A, EXERCISE_B]);
    });

    it('resolves the muscle-group filter to exercise ids passed to the core service', async () => {
      exerciseService.muscleGroupIds = [EXERCISE_B];

      await service.searchAsync(query({ muscleGroupId: MUSCLE_GROUP_ID }));

      expect(exerciseService.resolveIdsByMuscleGroupIdAsync).toHaveBeenCalledWith(MUSCLE_GROUP_ID);
      expect(workoutService.lastCriteria?.exerciseIds).toEqual([EXERCISE_B]);
    });

    it('intersects the name and muscle-group id sets when both filters are present (AND)', async () => {
      exerciseService.nameIds = [EXERCISE_A, EXERCISE_B];
      exerciseService.muscleGroupIds = [EXERCISE_B];

      await service.searchAsync(query({ exerciseName: 'press', muscleGroupId: MUSCLE_GROUP_ID }));

      expect(workoutService.lastCriteria?.exerciseIds).toEqual([EXERCISE_B]);
    });

    it('returns an empty result (not an error) when a filter resolves to no exercise ids', async () => {
      exerciseService.nameIds = [];

      const result = await service.searchAsync(query({ exerciseName: 'nope' }));

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
      expect(workoutService.searchHistoryAsync).not.toHaveBeenCalled();
    });

    it('returns an empty result when the intersection of both filters is empty', async () => {
      exerciseService.nameIds = [EXERCISE_A];
      exerciseService.muscleGroupIds = [EXERCISE_B];

      const result = await service.searchAsync(
        query({ exerciseName: 'press', muscleGroupId: MUSCLE_GROUP_ID }),
      );

      expect(result.items).toEqual([]);
      expect(workoutService.searchHistoryAsync).not.toHaveBeenCalled();
    });

    it('throws a ValidationException for a malformed cursor', async () => {
      await expect(service.searchAsync(query({ cursor: '!!!not-base64-json' }))).rejects.toBeInstanceOf(
        ValidationException,
      );
      expect(workoutService.searchHistoryAsync).not.toHaveBeenCalled();
    });

    it('passes a decoded valid cursor to the core service', async () => {
      const cursor = encodeCursor({ performedAt: DAY_2, id: ENTRY_2 });

      await service.searchAsync(query({ cursor }));

      expect(workoutService.lastCriteria?.cursor).toEqual({ performedAt: DAY_2, id: ENTRY_2 });
    });

    it('passes the date-range bounds through as Dates', async () => {
      await service.searchAsync(
        query({ from: DAY_1.toISOString(), to: DAY_2.toISOString() }),
      );

      expect(workoutService.lastCriteria?.from).toEqual(DAY_1);
      expect(workoutService.lastCriteria?.to).toEqual(DAY_2);
    });

    it('passes undefined exerciseIds when no exercise/muscle filter is applied', async () => {
      await service.searchAsync(query());

      expect(workoutService.lastCriteria?.exerciseIds).toBeUndefined();
    });

    it('returns an empty result (not an error) for a known user with no rows', async () => {
      workoutService.page = { items: [], hasMore: false };

      const result = await service.searchAsync(query());

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });
  });
  //#endregion
});
