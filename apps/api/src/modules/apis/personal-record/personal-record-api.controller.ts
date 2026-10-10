import { Controller, Get, HttpCode, HttpStatus, Inject, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IJoiService } from '../../../common/services/joi/joi-service.interface';
import { JoiServiceInjectionTokens } from '../../../common/services/joi/joi-injection-tokens';
import { IPersonalRecordQueryService } from './services/personal-record-query/personal-record-query-service.interface';
import { PersonalRecordQueryServiceInjectionTokens } from './services/personal-record-query/personal-record-query-injection-tokens';
import { IPersonalRecordComparisonService } from './services/personal-record-comparison/personal-record-comparison-service.interface';
import { PersonalRecordComparisonServiceInjectionTokens } from './services/personal-record-comparison/personal-record-comparison-injection-tokens';
import { GetPersonalRecordQueryDto } from './dto/get-personal-record-query.dto';
import { getPersonalRecordQueryJoiSchema } from './dto/get-personal-record-query.joi-schema';
import { PersonalRecordDto } from './dto/personal-record.dto';
import { GetPersonalRecordComparisonQueryDto } from './dto/get-personal-record-comparison-query.dto';
import { getPersonalRecordComparisonQueryJoiSchema } from './dto/get-personal-record-comparison-query.joi-schema';
import { PersonalRecordComparisonDto } from './dto/personal-record-comparison.dto';

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
    @Inject(PersonalRecordComparisonServiceInjectionTokens.SERVICE__PERSONAL_RECORD_COMPARISON)
    private readonly __personalRecordComparisonService: IPersonalRecordComparisonService,
  ) {}
  //#endregion

  //#region Methods
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get personal records for an exercise' })
  @ApiOkResponse({
    description:
      'The three personal records (max weight, max volume, best 1RM) for a user+exercise, each with ' +
      'its achievement date, weights in the requested unit (null metrics when the exercise exists ' +
      'but has no logged sets).',
  })
  @ApiBadRequestResponse({
    description:
      'The request failed validation (`VALIDATION_ISSUE`) — e.g. a missing/malformed `userId`, ' +
      '`exerciseId`, or an unsupported `unit`.',
  })
  @ApiNotFoundResponse({
    description:
      'A referenced resource does not exist. The stable `code` distinguishes which one: ' +
      '`USER_NOT_FOUND` when the `userId` has no matching user, or `EXERCISE_NOT_FOUND` when the ' +
      '`exerciseId` has no matching exercise.',
  })
  public async getAsync(@Query() query: GetPersonalRecordQueryDto): Promise<PersonalRecordDto> {
    // 2. Validate request (shape & types) — required userId, exerciseId, and unit.
    const instance = await this.__joiService.validateAsync(query, getPersonalRecordQueryJoiSchema);

    // 4–5. User/exercise existence checks, index-backed aggregation, and unit conversion are
    // orchestrated by the personal-record query service.
    return this.__personalRecordQueryService.getAsync(instance);
  }

  @Get('comparison')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Compare personal records across periods' })
  @ApiOkResponse({
    description:
      'Side-by-side current and previous period PR blocks (max weight, max volume, best 1RM) plus a ' +
      'server-computed per-metric delta. Period boundaries are derived in the requested IANA timezone; ' +
      'weights are in the requested unit (null metrics when a period has no sets).',
  })
  public async getComparisonAsync(
    @Query() query: GetPersonalRecordComparisonQueryDto,
  ): Promise<PersonalRecordComparisonDto> {
    // 2. Validate request (shape & types) — required userId, exerciseId, granularity, timezone, unit.
    const instance = await this.__joiService.validateAsync(
      query,
      getPersonalRecordComparisonQueryJoiSchema,
    );

    // 4–5. User/exercise existence checks, timezone-aware period windows, per-window aggregation,
    // unit conversion, and delta computation are orchestrated by the comparison service.
    return this.__personalRecordComparisonService.compareAsync(instance);
  }
  //#endregion
}
