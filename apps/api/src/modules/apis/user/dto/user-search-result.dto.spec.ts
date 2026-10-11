import { UserSearchResultDto } from './user-search-result.dto';
import { UserDto } from './user.dto';
import { SearchResult } from '../../../../common/models/search-result';

function sampleItem(): UserDto {
  return new UserDto(
    '018f6b0a-0000-7000-8000-000000000001',
    'Alice',
    new Date('2026-10-10T08:30:00.000Z'),
  );
}

describe('UserSearchResultDto', () => {
  //#region constructor
  describe('constructor', () => {
    it('exposes exactly items and total and no limit/offset', () => {
      const instance = new UserSearchResultDto([sampleItem()], 1);

      expect(Object.keys(instance).sort()).toEqual(['items', 'total'].sort());
      expect('limit' in instance).toBe(false);
      expect('offset' in instance).toBe(false);
    });

    it('carries the provided values through', () => {
      const items = [sampleItem()];
      const instance = new UserSearchResultDto(items, 7);

      expect(instance.items).toBe(items);
      expect(instance.total).toBe(7);
    });

    it('leaves total undefined when omitted, without exposing limit/offset', () => {
      const instance = new UserSearchResultDto([]);

      expect(instance.total).toBeUndefined();
      expect('limit' in instance).toBe(false);
      expect('offset' in instance).toBe(false);
    });

    it('conforms to SearchResult<UserDto> at compile time', () => {
      // Compile-time guard: the DTO instance stays structurally assignable to `SearchResult<T>`, so
      // it can never drop or retype a required envelope field. (It does NOT catch an added
      // limit/offset — the key-shape assertions above and the absence of those fields on
      // `SearchResult<T>` provide that protection.)
      const conforming: SearchResult<UserDto> = new UserSearchResultDto([sampleItem()], 1);

      expect(conforming.items).toHaveLength(1);
    });
  });
  //#endregion
});
