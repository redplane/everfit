import { WorkoutHistorySearchResultDto } from './workout-history-search-result.dto';
import { WorkoutHistoryItemDto } from './workout-history-item.dto';
import { ICursorSearchResult } from '../../../../common/models/cursor-search-result';

function sampleItem(): WorkoutHistoryItemDto {
  return new WorkoutHistoryItemDto(
    '018f6b0a-0000-7000-8000-000000000010',
    '018f6b0a-0000-7000-8000-000000000020',
    'Bench press',
    new Date('2026-10-01T00:00:00.000Z'),
    'kg',
    [],
  );
}

describe('WorkoutHistorySearchResultDto', () => {
  //#region constructor
  describe('constructor', () => {
    it('exposes exactly items, limit, nextCursor and no total/offset', () => {
      const instance = new WorkoutHistorySearchResultDto([sampleItem()], 20, 'next-cursor');

      expect(Object.keys(instance).sort()).toEqual(['items', 'limit', 'nextCursor'].sort());
      expect('total' in instance).toBe(false);
      expect('offset' in instance).toBe(false);
    });

    it('carries the provided values through', () => {
      const items = [sampleItem()];
      const instance = new WorkoutHistorySearchResultDto(items, 50, null);

      expect(instance.items).toBe(items);
      expect(instance.limit).toBe(50);
      expect(instance.nextCursor).toBeNull();
    });

    it('conforms to ICursorSearchResult<WorkoutHistoryItemDto> at compile time', () => {
      // Compile-time guard: the DTO instance stays structurally assignable to
      // `ICursorSearchResult<T>`, so the DTO can never drop or retype a required cursor field
      // (`items`/`limit`/`nextCursor`) without breaking this line. Note it does NOT catch an added
      // `total`/`offset`: assigning a class *instance* (not a fresh object literal) skips the
      // excess-property check. The "no total/offset" protection comes instead from the service
      // return-type literal check (object literals assigned to `ICursorSearchResult<T>` reject extra
      // keys) plus the runtime `Object.keys` assertions below and in the service/controller specs.
      const conforming: ICursorSearchResult<WorkoutHistoryItemDto> =
        new WorkoutHistorySearchResultDto([sampleItem()], 20, 'next-cursor');

      expect(Object.keys(conforming).sort()).toEqual(['items', 'limit', 'nextCursor'].sort());
    });
  });
  //#endregion
});
