import { Controller, Get, HttpCode, HttpStatus, Inject, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IJoiService } from '../../../common/services/joi/joi-service.interface';
import { JoiServiceInjectionTokens } from '../../../common/services/joi/joi-injection-tokens';
import { IExerciseService } from '../../cores/exercise/services/exercise/exercise-service.interface';
import { ExerciseServiceInjectionTokens } from '../../cores/exercise/services/exercise/exercise-injection-tokens';
import { SearchResult } from '../../../common/models/search-result';
import { ExerciseDto } from './dto/exercise.dto';
import { GetExercisesQueryDto } from './dto/get-exercises-query.dto';
import { getExercisesQueryJoiSchema } from './dto/get-exercises-query.joi-schema';

@ApiTags('Exercises')
// The global prefix `api` is applied in main.ts (setGlobalPrefix), so the controller path must NOT
// repeat it — this resolves to `/api/exercises`, not `/api/api/exercises`.
@Controller({ path: 'exercises' })
export class ExerciseApiController {
  //#region Constructor
  public constructor(
    @Inject(JoiServiceInjectionTokens.SERVICE__JOI)
    private readonly __joiService: IJoiService,
    @Inject(ExerciseServiceInjectionTokens.SERVICE__EXERCISE)
    private readonly __exerciseService: IExerciseService,
  ) {}
  //#endregion

  //#region Methods
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List exercises' })
  @ApiOkResponse({
    description: 'An offset-paginated page of exercises, each with its mapped muscle groups.',
  })
  public async searchAsync(
    @Query() query: GetExercisesQueryDto,
  ): Promise<SearchResult<ExerciseDto>> {
    // 2. Validate request (shape & types) — defaults applied, optional filters validated.
    const instance = await this.__joiService.validateAsync(query, getExercisesQueryJoiSchema);

    // 5. Interact with the database (via the data-access service).
    const result = await this.__exerciseService.searchAsync({
      limit: instance.limit,
      offset: instance.offset,
      name: instance.name,
      muscleGroupId: instance.muscleGroupId,
    });

    return {
      items: result.items.map(ExerciseDto.fromEntity),
      total: result.total,
    };
  }
  //#endregion
}
