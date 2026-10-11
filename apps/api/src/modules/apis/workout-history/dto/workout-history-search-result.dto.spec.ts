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
      // Compile-time guard: if a `total`/`offset` field is ever added to the DTO (or the cursor
      // envelope gains one), this assignment stops type-checking and the build fails.
      const conforming: ICursorSearchResult<WorkoutHistoryItemDto> =
        new WorkoutHistorySearchResultDto([sampleItem()], 20, 'next-cursor');

      expect(Object.keys(conforming).sort()).toEqual(['items', 'limit', 'nextCursor'].sort());
    });
  });
  //#endregion
});
