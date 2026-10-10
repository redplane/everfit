import { ExerciseApiController } from './exercise-api.controller';
import { GetExercisesQueryDto } from './dto/get-exercises-query.dto';
import { JoiService } from '../../../common/services/joi/joi.service';
import { ValidationException } from '../../../common/exceptions/validation.exception';
import { IExerciseService } from '../../cores/exercise/services/exercise/exercise-service.interface';
import { ExerciseEntity } from '../../cores/exercise/entities/exercise.entity';
import { ExerciseMuscleGroupEntity } from '../../cores/exercise/entities/exercise-muscle-group.entity';
import { MuscleGroupEntity } from '../../cores/exercise/entities/muscle-group.entity';
import { SearchResult } from '../../../common/models/search-result';
import { ExerciseSearchCriteria } from '../../../models/criteria/exercise-search-criteria';

const CREATED_TIME = new Date('2026-10-10T08:30:00.000Z');
const EXERCISE_ID = '018f6b0a-0000-7000-8000-000000000001';
const MUSCLE_GROUP_ID = '018f6b0a-0000-7000-8000-0000000000a1';

function buildExerciseWithMuscleGroup(): ExerciseEntity {
  const exercise = new ExerciseEntity(EXERCISE_ID, 'Bench Press', CREATED_TIME);
  const muscleGroup = new MuscleGroupEntity(MUSCLE_GROUP_ID, 'Chest', CREATED_TIME);
  const mapping = new ExerciseMuscleGroupEntity(
    '018f6b0a-0000-7000-8000-0000000000b1',
    EXERCISE_ID,
    MUSCLE_GROUP_ID,
    CREATED_TIME,
  );
  mapping.muscleGroup = muscleGroup;
  exercise.exerciseMuscleGroups = [mapping];
  return exercise;
}

/**
 * Hand-rolled stub so the controller's mapping/propagation branches are tested in isolation, while
 * the real `JoiService` drives the validation branches.
 */
class StubExerciseService implements IExerciseService {
  public searchResult: SearchResult<ExerciseEntity> = { items: [], limit: 20, offset: 0, total: 0 };
  public lastSearchCriteria?: ExerciseSearchCriteria;

  public getByIdAsync(): Promise<ExerciseEntity> {
    return Promise.resolve(buildExerciseWithMuscleGroup());
  }
  public existsByIdAsync(): Promise<boolean> {
    return Promise.resolve(true);
  }
  public searchAsync(criteria: ExerciseSearchCriteria): Promise<SearchResult<ExerciseEntity>> {
    this.lastSearchCriteria = criteria;
    return Promise.resolve(this.searchResult);
  }
  public resolveIdsByNameLikeAsync(): Promise<string[]> {
    return Promise.resolve([]);
  }
  public resolveIdsByMuscleGroupIdAsync(): Promise<string[]> {
    return Promise.resolve([]);
  }
  public createAsync(): Promise<ExerciseEntity> {
    return Promise.resolve(buildExerciseWithMuscleGroup());
  }
  public mapMuscleGroupAsync(): Promise<ExerciseMuscleGroupEntity> {
    return Promise.resolve(
      new ExerciseMuscleGroupEntity('x', EXERCISE_ID, MUSCLE_GROUP_ID, CREATED_TIME),
    );
  }
}

describe('ExerciseApiController', () => {
  let controller: ExerciseApiController;
  let exerciseService: StubExerciseService;

  beforeEach(() => {
    exerciseService = new StubExerciseService();
    controller = new ExerciseApiController(new JoiService(), exerciseService);
  });

  //#region searchAsync
  describe('searchAsync', () => {
    it('returns a SearchResult mapping each entity to an ExerciseDto with nested muscle groups', async () => {
      exerciseService.searchResult = {
        items: [buildExerciseWithMuscleGroup()],
        limit: 20,
        offset: 0,
        total: 1,
      };

      const result = await controller.searchAsync({ limit: 20, offset: 0 } as GetExercisesQueryDto);

      expect(result.items).toEqual([
        {
          id: EXERCISE_ID,
          name: 'Bench Press',
          muscleGroups: [{ id: MUSCLE_GROUP_ID, name: 'Chest' }],
        },
      ]);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('maps an exercise with no mapping to an empty muscleGroups array', async () => {
      const exercise = new ExerciseEntity(EXERCISE_ID, 'Plank', CREATED_TIME);
      exercise.exerciseMuscleGroups = [];
      exerciseService.searchResult = { items: [exercise], limit: 20, offset: 0, total: 1 };

      const result = await controller.searchAsync({ limit: 20, offset: 0 } as GetExercisesQueryDto);

      expect(result.items[0].muscleGroups).toEqual([]);
    });

    it('applies the default pager (limit 20, offset 0) when omitted', async () => {
      await controller.searchAsync({} as GetExercisesQueryDto);

      expect(exerciseService.lastSearchCriteria).toEqual({
        limit: 20,
        offset: 0,
        name: undefined,
        muscleGroupId: undefined,
      });
    });

    it('forwards the optional name and muscleGroupId filters to the service', async () => {
      await controller.searchAsync({
        limit: 10,
        offset: 5,
        name: 'bench',
        muscleGroupId: MUSCLE_GROUP_ID,
      } as GetExercisesQueryDto);

      expect(exerciseService.lastSearchCriteria).toEqual({
        limit: 10,
        offset: 5,
        name: 'bench',
        muscleGroupId: MUSCLE_GROUP_ID,
      });
    });

    it('throws ValidationException (400) when limit exceeds 100', async () => {
      await expect(
        controller.searchAsync({ limit: 101, offset: 0 } as GetExercisesQueryDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when offset is negative', async () => {
      await expect(
        controller.searchAsync({ limit: 20, offset: -1 } as GetExercisesQueryDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when limit is not an integer', async () => {
      await expect(
        controller.searchAsync({ limit: 1.5, offset: 0 } as GetExercisesQueryDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when muscleGroupId is not a uuid', async () => {
      await expect(
        controller.searchAsync({
          limit: 20,
          offset: 0,
          muscleGroupId: 'not-a-uuid',
        } as GetExercisesQueryDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when name is blank', async () => {
      await expect(
        controller.searchAsync({ limit: 20, offset: 0, name: '   ' } as GetExercisesQueryDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('returns an empty SearchResult (not an error) when the service yields no items', async () => {
      exerciseService.searchResult = { items: [], limit: 20, offset: 40, total: 5 };

      const result = await controller.searchAsync({
        limit: 20,
        offset: 40,
      } as GetExercisesQueryDto);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(5);
    });
  });
  //#endregion
});
