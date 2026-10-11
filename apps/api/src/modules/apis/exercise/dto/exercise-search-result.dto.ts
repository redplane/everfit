import { ApiProperty } from '@nestjs/swagger';
import { ExerciseDto } from './exercise.dto';
import { SearchResult } from '../../../../common/models/search-result';

/**
 * Documentation response projection for the offset-paginated `GET /api/exercises` endpoint (F3).
 *
 * This advertises the exact offset shape — `items` + the server-computed `total` — and deliberately
 * omits the request-echo `limit`/`offset`. Per `docs/guidelines/best-practices/pagination.md` §II.1,
 * an offset-paginated response returns `items` + `total` only. It `implements`
 * `SearchResult<ExerciseDto>` so the documented shape is kept in lock-step with the offset wire
 * envelope the controller returns; this DTO exists so the OpenAPI/Scalar schema shows the fields a
 * client receives.
 */
export class ExerciseSearchResultDto implements SearchResult<ExerciseDto> {
  //#region Properties
  @ApiProperty({ description: 'The page of exercises.', type: () => [ExerciseDto] })
  public items: ExerciseDto[];

  @ApiProperty({
    required: false,
    type: Number,
    description: 'Total count of all matching rows (server-computed).',
  })
  public total?: number;
  //#endregion

  //#region Constructor
  public constructor(items: ExerciseDto[], total?: number) {
    this.items = items;
    this.total = total;
  }
  //#endregion
}
