import { MuscleGroupEntity } from '../../entities/muscle-group.entity';
import { CreateMuscleGroupOptions } from '../../../../../models/options/create-muscle-group-options';
import { MuscleGroupSearchCriteria } from '../../../../../models/criteria/muscle-group-search-criteria';
import { SearchResult } from '../../../../../common/models/search-result';

/**
 * Contract for muscle-group master-data access (F3). Consumed by the muscle-group API module and
 * the seed CLI (Task 9) via the `SERVICE__MUSCLE_GROUP` token.
 */
export interface IMuscleGroupService {
  //#region Methods
  /**
   * Returns the muscle group with the given id, or throws `MuscleGroupByIdNotFoundException` if none
   * exists.
   */
  getByIdAsync(id: string): Promise<MuscleGroupEntity>;

  /**
   * Returns whether a muscle group with the given id exists. Does not throw for a missing record.
   */
  existsByIdAsync(id: string): Promise<boolean>;

  /**
   * Returns an offset-paginated page of muscle groups with a stable ordering (`name ASC, id ASC`).
   * A page beyond the data yields empty `items` with the correct `total` — not an error.
   */
  searchAsync(criteria: MuscleGroupSearchCriteria): Promise<SearchResult<MuscleGroupEntity>>;

  /**
   * Persists a new muscle group and returns it. The id (UUID v7) and `createdTime` are assigned
   * here. Used by the seed CLI (Task 9).
   */
  createAsync(options: CreateMuscleGroupOptions): Promise<MuscleGroupEntity>;
  //#endregion
}
