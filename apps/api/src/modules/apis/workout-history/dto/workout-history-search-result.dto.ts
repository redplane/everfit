import { ApiProperty } from '@nestjs/swagger';
import { WorkoutHistoryItemDto } from './workout-history-item.dto';

/**
 * Documentation response projection for the cursor-paginated workout-history endpoint (F6).
 *
 * This advertises the exact cursor shape — `items` + the served `limit` + a `nextCursor` — and
 * deliberately omits `total` and `offset`. Per `docs/guidelines/best-practices/pagination.md` §II.2,
 * a cursor-paginated response MUST NOT carry a `total` count. The controller returns the shared
 * `SearchResult<T>` envelope (structurally compatible); this DTO exists so the OpenAPI/Scalar schema
 * shows only the fields a cursor client receives.
 */
export class WorkoutHistorySearchResultDto {
  //#region Properties
  @ApiProperty({ description: 'The page of workout-history entries.', type: () => [WorkoutHistoryItemDto] })
  public items: WorkoutHistoryItemDto[];

  @ApiProperty({ description: 'The page size served (1..100, default 20).' })
  public limit: number;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Opaque cursor for the next page; null on the last page.',
  })
  public nextCursor: string | null;
  //#endregion

  //#region Constructor
  public constructor(items: WorkoutHistoryItemDto[], limit: number, nextCursor: string | null) {
    this.items = items;
    this.limit = limit;
    this.nextCursor = nextCursor;
  }
  //#endregion
}
