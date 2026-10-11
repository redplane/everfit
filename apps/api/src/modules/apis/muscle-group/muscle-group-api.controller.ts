import { Controller, Get, HttpCode, HttpStatus, Inject, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IJoiService } from '../../../common/services/joi/joi-service.interface';
import { JoiServiceInjectionTokens } from '../../../common/services/joi/joi-injection-tokens';
import { IMuscleGroupService } from '../../cores/exercise/services/muscle-group/muscle-group-service.interface';
import { MuscleGroupServiceInjectionTokens } from '../../cores/exercise/services/muscle-group/muscle-group-injection-tokens';
import { SearchResult } from '../../../common/models/search-result';
import { MuscleGroupDto } from './dto/muscle-group.dto';
import { GetMuscleGroupsQueryDto } from './dto/get-muscle-groups-query.dto';
import { getMuscleGroupsQueryJoiSchema } from './dto/get-muscle-groups-query.joi-schema';

@ApiTags('Muscle groups')
// The global prefix `api` is applied in main.ts (setGlobalPrefix), so the controller path must NOT
// repeat it — this resolves to `/api/muscle-groups`, not `/api/api/muscle-groups`.
@Controller({ path: 'muscle-groups' })
export class MuscleGroupApiController {
  //#region Constructor
  public constructor(
    @Inject(JoiServiceInjectionTokens.SERVICE__JOI)
    private readonly __joiService: IJoiService,
    @Inject(MuscleGroupServiceInjectionTokens.SERVICE__MUSCLE_GROUP)
    private readonly __muscleGroupService: IMuscleGroupService,
  ) {}
  //#endregion

  //#region Methods
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List muscle groups' })
  @ApiOkResponse({ description: 'An offset-paginated page of muscle groups.' })
  public async searchAsync(
    @Query() query: GetMuscleGroupsQueryDto,
  ): Promise<SearchResult<MuscleGroupDto>> {
    // 2. Validate request (shape & types) — defaults applied, coerced to numbers.
    const instance = await this.__joiService.validateAsync(query, getMuscleGroupsQueryJoiSchema);

    // 5. Interact with the database (via the data-access service).
    const result = await this.__muscleGroupService.searchAsync({
      limit: instance.limit,
      offset: instance.offset,
    });

    return {
      items: result.items.map(MuscleGroupDto.fromEntity),
      total: result.total,
    };
  }
  //#endregion
}
