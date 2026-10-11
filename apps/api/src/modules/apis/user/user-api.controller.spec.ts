import { UserApiController } from './user-api.controller';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { GetUserParamDto } from './dto/get-user-param.dto';
import { JoiService } from '../../../common/services/joi/joi.service';
import { ValidationException } from '../../../common/exceptions/validation.exception';
import { IUserService } from '../../cores/user/services/user/user-service.interface';
import { UserEntity } from '../../cores/user/entities/user.entity';
import { UserByIdNotFoundException } from '../../cores/user/exceptions/user-by-id-not-found.exception';
import { SearchResult } from '../../../common/models/search-result';

const EXISTING_ID = '018f6b0a-0000-7000-8000-000000000001';
const CREATED_TIME = new Date('2026-10-10T08:30:00.000Z');

function buildUser(id: string, name: string): UserEntity {
  return new UserEntity(id, name, CREATED_TIME);
}

/**
 * Hand-rolled stub so the controller's mapping/propagation branches are tested in isolation,
 * while the real `JoiService` drives the validation branches.
 */
class StubUserService implements IUserService {
  public searchResult: SearchResult<UserEntity> = {
    items: [],
    limit: 20,
    offset: 0,
    total: 0,
  };
  public lastSearchCriteria?: { limit: number; offset: number };
  public getByIdError?: Error;

  public getByIdAsync(id: string): Promise<UserEntity> {
    if (this.getByIdError) {
      return Promise.reject(this.getByIdError);
    }
    return Promise.resolve(buildUser(id, 'Alice'));
  }

  public existsByIdAsync(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public searchAsync(criteria: {
    limit: number;
    offset: number;
  }): Promise<SearchResult<UserEntity>> {
    this.lastSearchCriteria = criteria;
    return Promise.resolve(this.searchResult);
  }

  public createAsync(): Promise<UserEntity> {
    return Promise.resolve(buildUser(EXISTING_ID, 'Alice'));
  }
}

describe('UserApiController', () => {
  let controller: UserApiController;
  let userService: StubUserService;

  beforeEach(() => {
    userService = new StubUserService();
    controller = new UserApiController(new JoiService(), userService);
  });

  //#region getAsync
  describe('getAsync', () => {
    it('validates the param and returns a UserDto for an existing user', async () => {
      const result = await controller.getAsync({ id: EXISTING_ID } as GetUserParamDto);

      expect(result).toEqual({ id: EXISTING_ID, name: 'Alice', createdTime: CREATED_TIME });
    });

    it('propagates UserByIdNotFoundException when the user is unknown', async () => {
      userService.getByIdError = new UserByIdNotFoundException(EXISTING_ID);

      await expect(
        controller.getAsync({ id: EXISTING_ID } as GetUserParamDto),
      ).rejects.toBeInstanceOf(UserByIdNotFoundException);
    });

    it('throws ValidationException (400) for a malformed, non-uuid id', async () => {
      await expect(
        controller.getAsync({ id: 'not-a-uuid' } as GetUserParamDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when the id is missing', async () => {
      await expect(controller.getAsync({} as GetUserParamDto)).rejects.toBeInstanceOf(
        ValidationException,
      );
    });
  });
  //#endregion

  //#region searchAsync
  describe('searchAsync', () => {
    it('returns a SearchResult mapping each entity to a UserDto', async () => {
      userService.searchResult = {
        items: [buildUser(EXISTING_ID, 'Alice')],
        limit: 20,
        offset: 0,
        total: 1,
      };

      const result = await controller.searchAsync({ limit: 20, offset: 0 } as GetUsersQueryDto);

      expect(result.items).toEqual([
        { id: EXISTING_ID, name: 'Alice', createdTime: CREATED_TIME },
      ]);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('applies the default pager (limit 20, offset 0) when both are omitted', async () => {
      await controller.searchAsync({} as GetUsersQueryDto);

      expect(userService.lastSearchCriteria).toEqual({ limit: 20, offset: 0 });
    });

    it('throws ValidationException (400) when limit exceeds 100', async () => {
      await expect(
        controller.searchAsync({ limit: 101, offset: 0 } as GetUsersQueryDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when offset is negative', async () => {
      await expect(
        controller.searchAsync({ limit: 20, offset: -1 } as GetUsersQueryDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when limit is not an integer', async () => {
      await expect(
        controller.searchAsync({ limit: 1.5, offset: 0 } as GetUsersQueryDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('returns an empty SearchResult (not an error) when the service yields no items', async () => {
      userService.searchResult = { items: [], limit: 20, offset: 40, total: 5 };

      const result = await controller.searchAsync({ limit: 20, offset: 40 } as GetUsersQueryDto);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(5);
    });

    // F6 — offset endpoints keep their contract: the response MUST carry both `total` and `offset`
    // (the half of the pagination rule that cursor endpoints omit). Guards against accidental drift.
    it('includes both the total and offset keys in the offset response body', async () => {
      userService.searchResult = {
        items: [buildUser(EXISTING_ID, 'Alice')],
        limit: 20,
        offset: 0,
        total: 1,
      };

      const result = await controller.searchAsync({ limit: 20, offset: 0 } as GetUsersQueryDto);

      expect(Object.prototype.hasOwnProperty.call(result, 'total')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(result, 'offset')).toBe(true);
    });
  });
  //#endregion
});
