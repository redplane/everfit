import { Controller, Get, HttpCode, HttpStatus, Inject, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IJoiService } from '../../../common/services/joi/joi-service.interface';
import { JoiServiceInjectionTokens } from '../../../common/services/joi/joi-injection-tokens';
import { IPersonalRecordQueryService } from './services/personal-record-query/personal-record-query-service.interface';
import { PersonalRecordQueryServiceInjectionTokens } from './services/personal-record-query/personal-record-query-injection-tokens';
import { GetPersonalRecordQueryDto } from './dto/get-personal-record-query.dto';
import { getPersonalRecordQueryJoiSchema } from './dto/get-personal-record-query.joi-schema';
import { PersonalRecordDto } from './dto/personal-record.dto';

@ApiTags('Personal records')
// The global prefix `api` is applied in main.ts (setGlobalPrefix), so the controller path must NOT
// repeat it — this resolves to `/api/personal-record`, not `/api/api/personal-record`.
@Controller({ path: 'personal-record' })
export class PersonalRecordApiController {
  //#region Constructor
  public constructor(
    @Inject(JoiServiceInjectionTokens.SERVICE__JOI)
    private readonly __joiService: IJoiService,
    @Inject(PersonalRecordQueryServiceInjectionTokens.SERVICE__PERSONAL_RECORD_QUERY)
    private readonly __personalRecordQueryService: IPersonalRecordQueryService,
  ) {}
  //#endregion

  //#region Methods
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get personal records for an exercise' })
  @ApiOkResponse({
    description:
      'The three personal records (max weight, max volume, best 1RM) for a user+exercise, each with ' +
      'its achievement date, weights in the requested unit (null metrics when there are no sets).',
  })
  public async getAsync(@Query() query: GetPersonalRecordQueryDto): Promise<PersonalRecordDto> {
    // 2. Validate request (shape & types) — required userId, exerciseId, and unit.
    const instance = await this.__joiService.validateAsync(query, getPersonalRecordQueryJoiSchema);

    // 4–5. User/exercise existence checks, index-backed aggregation, and unit conversion are
    // orchestrated by the personal-record query service.
    return this.__personalRecordQueryService.getAsync(instance);
  }
  //#endregion
}
