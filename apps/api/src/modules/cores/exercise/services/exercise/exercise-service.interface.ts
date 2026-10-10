import { ExerciseEntity } from '../../entities/exercise.entity';
import { ExerciseMuscleGroupEntity } from '../../entities/exercise-muscle-group.entity';
import { CreateExerciseOptions } from '../../../../../models/options/create-exercise-options';
import { ExerciseSearchCriteria } from '../../../../../models/criteria/exercise-search-criteria';
import { SearchResult } from '../../../../../common/models/search-result';

/**
 * Contract for exercise catalogue access and the configurable exercise↔muscle-group mapping (F3).
 * Consumed by the exercise API module and, downstream, by logging (F5, existence check) and history
 * filtering (F6, id resolution) via the `SERVICE__EXERCISE` token.
 */
export interface IExerciseService {
  //#region Methods
  /**
   * Returns the exercise with the given id, or throws `ExerciseByIdNotFoundException` if none
   * exists.
   */
  getByIdAsync(id: string): Promise<ExerciseEntity>;

  /**
   * Returns whether an exercise with the given id exists. Does not throw for a missing exercise.
   * Used by logging (F5) to reject a workout against a non-existent exercise.
   */
  existsByIdAsync(id: string): Promise<boolean>;

  /**
   * Returns an offset-paginated page of exercises with a stable ordering (`name ASC, id ASC`),
   * eager-loading each exercise's mapped muscle groups. Optional filters: partial `name`
   * (case-insensitive) and `muscleGroupId`. A page beyond the data yields empty `items` with the
   * correct `total` — not an error.
   */
  searchAsync(criteria: ExerciseSearchCriteria): Promise<SearchResult<ExerciseEntity>>;

  /**
   * Returns the ids of exercises whose name partially (case-insensitively) matches the term, for
   * the history name filter (F6). An empty array when nothing matches.
   */
  resolveIdsByNameLikeAsync(term: string): Promise<string[]>;

  /**
   * Returns the ids of exercises mapped to the given muscle group, for the history muscle-group
   * filter (F6). An empty array when nothing is mapped.
   */
  resolveIdsByMuscleGroupIdAsync(muscleGroupId: string): Promise<string[]>;

  /**
   * Persists a new exercise and returns it. The id (UUID v7) and `createdTime` are assigned here.
   * Used by the seed CLI (Task 9).
   */
  createAsync(options: CreateExerciseOptions): Promise<ExerciseEntity>;

  /**
   * Maps an exercise to a muscle group and returns the join row. Throws
   * `ExerciseMuscleGroupAlreadyExistsException` when the `(exercise, muscle group)` pair already
   * exists (the unique pair is not silently duplicated). Used by the seed CLI (Task 9).
   */
  mapMuscleGroupAsync(
    exerciseId: string,
    muscleGroupId: string,
  ): Promise<ExerciseMuscleGroupEntity>;
  //#endregion
}
