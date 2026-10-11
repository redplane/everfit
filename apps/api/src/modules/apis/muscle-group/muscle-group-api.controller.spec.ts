import { MuscleGroupApiController } from './muscle-group-api.controller';
import { GetMuscleGroupsQueryDto } from './dto/get-muscle-groups-query.dto';
import { JoiService } from '../../../common/services/joi/joi.service';
import { ValidationException } from '../../../common/exceptions/validation.exception';
import { IMuscleGroupService } from '../../cores/exercise/services/muscle-group/muscle-group-service.interface';
import { MuscleGroupEntity } from '../../cores/exercise/entities/muscle-group.entity';
import { SearchResult } from '../../../common/models/search-result';
import { MuscleGroupSearchCriteria } from '../../../models/criteria/muscle-group-search-criteria';

const CREATED_TIME = new Date('2026-10-10T08:30:00.000Z');
const MUSCLE_GROUP_ID = '018f6b0a-0000-7000-8000-0000000000a1';

function buildMuscleGroup(id: string, name: string): MuscleGroupEntity {
  return new MuscleGroupEntity(id, name, CREATED_TIME);
}

class StubMuscleGroupService implements IMuscleGroupService {
  public searchResult: SearchResult<MuscleGroupEntity> = {
    items: [],
    limit: 20,
    offset: 0,
    total: 0,
  };
  public lastSearchCriteria?: MuscleGroupSearchCriteria;

  public getByIdAsync(id: string): Promise<MuscleGroupEntity> {
    return Promise.resolve(buildMuscleGroup(id, 'Chest'));
  }
  public existsByIdAsync(): Promise<boolean> {
    return Promise.resolve(true);
  }
  public searchAsync(
    criteria: MuscleGroupSearchCriteria,
  ): Promise<SearchResult<MuscleGroupEntity>> {
    this.lastSearchCriteria = criteria;
    return Promise.resolve(this.searchResult);
  }
  public createAsync(): Promise<MuscleGroupEntity> {
    return Promise.resolve(buildMuscleGroup(MUSCLE_GROUP_ID, 'Chest'));
  }
}

describe('MuscleGroupApiController', () => {
  let controller: MuscleGroupApiController;
  let muscleGroupService: StubMuscleGroupService;

  beforeEach(() => {
    muscleGroupService = new StubMuscleGroupService();
    controller = new MuscleGroupApiController(new JoiService(), muscleGroupService);
  });

  //#region searchAsync
  describe('searchAsync', () => {
    it('returns a SearchResult mapping each entity to a MuscleGroupDto', async () => {
      muscleGroupService.searchResult = {
        items: [buildMuscleGroup(MUSCLE_GROUP_ID, 'Chest')],
        limit: 20,
        offset: 0,
        total: 1,
      };

      const result = await controller.searchAsync({
        limit: 20,
        offset: 0,
      } as GetMuscleGroupsQueryDto);

      expect(result.items).toEqual([{ id: MUSCLE_GROUP_ID, name: 'Chest' }]);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('applies the default pager (limit 20, offset 0) when both are omitted', async () => {
      await controller.searchAsync({} as GetMuscleGroupsQueryDto);

      expect(muscleGroupService.lastSearchCriteria).toEqual({ limit: 20, offset: 0 });
    });

    it('throws ValidationException (400) when limit exceeds 100', async () => {
      await expect(
        controller.searchAsync({ limit: 101, offset: 0 } as GetMuscleGroupsQueryDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when offset is negative', async () => {
      await expect(
        controller.searchAsync({ limit: 20, offset: -1 } as GetMuscleGroupsQueryDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when limit is not an integer', async () => {
      await expect(
        controller.searchAsync({ limit: 1.5, offset: 0 } as GetMuscleGroupsQueryDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('returns an empty SearchResult (not an error) when the service yields no items', async () => {
      muscleGroupService.searchResult = { items: [], limit: 20, offset: 40, total: 5 };

      const result = await controller.searchAsync({
        limit: 20,
        offset: 40,
      } as GetMuscleGroupsQueryDto);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(5);
    });
  });
  //#endregion
});
