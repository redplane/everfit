import { WorkoutHistoryApiController } from './workout-history-api.controller';
import { IWorkoutHistoryQueryService } from './services/workout-history-query/workout-history-query-service.interface';
import { GetWorkoutHistoryQueryDto } from './dto/get-workout-history-query.dto';
import { WorkoutHistoryItemDto } from './dto/workout-history-item.dto';
import { JoiService } from '../../../common/services/joi/joi.service';
import { ValidationException } from '../../../common/exceptions/validation.exception';
import { SearchResult } from '../../../common/models/search-result';
import { UserByIdNotFoundException } from '../../cores/user/exceptions/user-by-id-not-found.exception';

const USER_ID = '018f6b0a-0000-7000-8000-000000000001';
const MUSCLE_GROUP_ID = '018f6b0a-0000-7000-8000-0000000000c1';

class StubWorkoutHistoryQueryService implements IWorkoutHistoryQueryService {
  public result: SearchResult<WorkoutHistoryItemDto> = { items: [], limit: 20, nextCursor: null };
  public error?: Error;
  public lastQuery?: GetWorkoutHistoryQueryDto;

  public searchAsync(
    query: GetWorkoutHistoryQueryDto,
  ): Promise<SearchResult<WorkoutHistoryItemDto>> {
    this.lastQuery = query;
    if (this.error) {
      return Promise.reject(this.error);
    }
    return Promise.resolve(this.result);
  }
}

function validQuery(overrides?: Partial<GetWorkoutHistoryQueryDto>): GetWorkoutHistoryQueryDto {
  return { userId: USER_ID, unit: 'kg', ...overrides } as GetWorkoutHistoryQueryDto;
}

describe('WorkoutHistoryApiController', () => {
  let controller: WorkoutHistoryApiController;
  let queryService: StubWorkoutHistoryQueryService;

  beforeEach(() => {
    queryService = new StubWorkoutHistoryQueryService();
    controller = new WorkoutHistoryApiController(new JoiService(), queryService);
  });

  //#region searchAsync
  describe('searchAsync', () => {
    it('validates the query, applies the default limit, and delegates to the query service', async () => {
      const result = await controller.searchAsync(validQuery());

      expect(result).toBe(queryService.result);
      expect(queryService.lastQuery?.limit).toBe(20);
      expect(queryService.lastQuery?.userId).toBe(USER_ID);
    });

    it('accepts the optional filters and coerces dates', async () => {
      await controller.searchAsync(
        validQuery({
          exerciseName: 'press',
          muscleGroupId: MUSCLE_GROUP_ID,
          from: '2026-10-01T00:00:00.000Z',
          to: '2026-10-02T00:00:00.000Z',
        }),
      );

      expect(queryService.lastQuery?.exerciseName).toBe('press');
      expect(queryService.lastQuery?.muscleGroupId).toBe(MUSCLE_GROUP_ID);
    });

    it('throws ValidationException (400) when unit is missing', async () => {
      await expect(
        controller.searchAsync({ userId: USER_ID } as GetWorkoutHistoryQueryDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when unit is unsupported', async () => {
      await expect(controller.searchAsync(validQuery({ unit: 'stone' }))).rejects.toBeInstanceOf(
        ValidationException,
      );
    });

    it('throws ValidationException (400) when userId is missing', async () => {
      await expect(
        controller.searchAsync({ unit: 'kg' } as GetWorkoutHistoryQueryDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when userId is not a uuid', async () => {
      await expect(controller.searchAsync(validQuery({ userId: 'nope' }))).rejects.toBeInstanceOf(
        ValidationException,
      );
    });

    it('throws ValidationException (400) when `to` is before `from`', async () => {
      await expect(
        controller.searchAsync(
          validQuery({ from: '2026-10-02T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' }),
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when limit exceeds 100', async () => {
      await expect(controller.searchAsync(validQuery({ limit: 101 }))).rejects.toBeInstanceOf(
        ValidationException,
      );
    });

    it('propagates UserByIdNotFoundException (404) from the service', async () => {
      queryService.error = new UserByIdNotFoundException(USER_ID);

      await expect(controller.searchAsync(validQuery())).rejects.toBeInstanceOf(
        UserByIdNotFoundException,
      );
    });

    // F6 — cursor-pagination response-shape compliance: the controller passes the service shape
    // through unchanged, which must expose items/limit/nextCursor and no `total` key.
    it('returns a body with no total key and exposes items/limit/nextCursor', async () => {
      queryService.result = { items: [], limit: 20, nextCursor: 'next-cursor' };

      const result = await controller.searchAsync(validQuery());

      expect('total' in result).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(result, 'total')).toBe(false);
      expect('items' in result && 'limit' in result && 'nextCursor' in result).toBe(true);
    });
  });
  //#endregion
});
