import { Controller, Get, HttpCode, HttpStatus, Inject, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IJoiService } from '../../../common/services/joi/joi-service.interface';
import { JoiServiceInjectionTokens } from '../../../common/services/joi/joi-injection-tokens';
import { IWorkoutHistoryQueryService } from './services/workout-history-query/workout-history-query-service.interface';
import { WorkoutHistoryQueryServiceInjectionTokens } from './services/workout-history-query/workout-history-query-injection-tokens';
import { GetWorkoutHistoryQueryDto } from './dto/get-workout-history-query.dto';
import { getWorkoutHistoryQueryJoiSchema } from './dto/get-workout-history-query.joi-schema';
import { WorkoutHistoryItemDto } from './dto/workout-history-item.dto';
import { SearchResult } from '../../../common/models/search-result';

@ApiTags('Workouts')
// The global prefix `api` is applied in main.ts (setGlobalPrefix), so the controller path must NOT
// repeat it — this resolves to `/api/workout-history`, not `/api/api/workout-history`.
@Controller({ path: 'workout-history' })
export class WorkoutHistoryApiController {
  //#region Constructor
  public constructor(
    @Inject(JoiServiceInjectionTokens.SERVICE__JOI)
    private readonly __joiService: IJoiService,
    @Inject(WorkoutHistoryQueryServiceInjectionTokens.SERVICE__WORKOUT_HISTORY_QUERY)
    private readonly __workoutHistoryQueryService: IWorkoutHistoryQueryService,
  ) {}
  //#endregion

  //#region Methods
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get workout history' })
  @ApiOkResponse({
    description: 'A cursor-paginated page of the user’s workout history, weights in the requested unit.',
  })
  public async searchAsync(
    @Query() query: GetWorkoutHistoryQueryDto,
  ): Promise<SearchResult<WorkoutHistoryItemDto>> {
    // 2. Validate request (shape & types) — required userId + unit, optional filters, cursor/limit.
    const instance = await this.__joiService.validateAsync(query, getWorkoutHistoryQueryJoiSchema);

    // 4–5. Domain checks, filter/cursor resolution, keyset read, and unit conversion are orchestrated
    // by the history query service.
    return this.__workoutHistoryQueryService.searchAsync(instance);
  }
  //#endregion
}
