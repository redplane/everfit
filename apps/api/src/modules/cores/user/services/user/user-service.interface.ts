import { UserEntity } from '../../entities/user.entity';
import { CreateUserOptions } from '../../../../../models/options/create-user-options';
import { UserSearchCriteria } from '../../../../../models/criteria/user-search-criteria';
import { SearchResult } from '../../../../../common/models/search-result';

/**
 * Contract for user master-data access (F2). Consumed by the user API module and, downstream, by
 * every read feature (F5–F8) to validate user existence via the `SERVICE__USER` token.
 */
export interface IUserService {
  //#region Methods
  /**
   * Returns the user with the given id, or throws `UserByIdNotFoundException` if none exists.
   */
  getByIdAsync(id: string): Promise<UserEntity>;

  /**
   * Returns whether a user with the given id exists. Does not throw for a missing user.
   */
  existsByIdAsync(id: string): Promise<boolean>;

  /**
   * Returns an offset-paginated page of users with a stable ordering (`name ASC, id ASC`).
   * A page beyond the data yields empty `items` with the correct `total` — not an error.
   */
  searchAsync(criteria: UserSearchCriteria): Promise<SearchResult<UserEntity>>;

  /**
   * Persists a new user and returns it. The id (UUID v7) and `createdTime` are assigned here.
   */
  createAsync(options: CreateUserOptions): Promise<UserEntity>;
  //#endregion
}
