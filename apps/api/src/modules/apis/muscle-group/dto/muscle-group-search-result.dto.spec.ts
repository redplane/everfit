import { MuscleGroupSearchResultDto } from './muscle-group-search-result.dto';
import { MuscleGroupDto } from './muscle-group.dto';
import { SearchResult } from '../../../../common/models/search-result';

function sampleItem(): MuscleGroupDto {
  return new MuscleGroupDto('018f6b0a-0000-7000-8000-000000000001', 'Chest');
}

describe('MuscleGroupSearchResultDto', () => {
  //#region constructor
  describe('constructor', () => {
    it('exposes exactly items and total and no limit/offset', () => {
      const instance = new MuscleGroupSearchResultDto([sampleItem()], 1);

      expect(Object.keys(instance).sort()).toEqual(['items', 'total'].sort());
      expect('limit' in instance).toBe(false);
      expect('offset' in instance).toBe(false);
    });

    it('carries the provided values through', () => {
      const items = [sampleItem()];
      const instance = new MuscleGroupSearchResultDto(items, 7);

      expect(instance.items).toBe(items);
      expect(instance.total).toBe(7);
    });

    it('leaves total undefined when omitted, without exposing limit/offset', () => {
      const instance = new MuscleGroupSearchResultDto([]);

      expect(instance.total).toBeUndefined();
      expect('limit' in instance).toBe(false);
      expect('offset' in instance).toBe(false);
    });

    it('conforms to SearchResult<MuscleGroupDto> at compile time', () => {
      // Compile-time guard: the DTO instance stays structurally assignable to `SearchResult<T>`, so
      // it can never drop or retype a required envelope field. (It does NOT catch an added
      // limit/offset — the key-shape assertions above and the absence of those fields on
      // `SearchResult<T>` provide that protection.)
      const conforming: SearchResult<MuscleGroupDto> = new MuscleGroupSearchResultDto(
        [sampleItem()],
        1,
      );

      expect(conforming.items).toHaveLength(1);
    });
  });
  //#endregion
});
