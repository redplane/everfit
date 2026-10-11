import { Controller, Get, HttpCode, HttpStatus, Inject, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IJoiService } from '../../../common/services/joi/joi-service.interface';
import { JoiServiceInjectionTokens } from '../../../common/services/joi/joi-injection-tokens';
import { IUserService } from '../../cores/user/services/user/user-service.interface';
import { UserServiceInjectionTokens } from '../../cores/user/services/user/user-injection-tokens';
import { SearchResult } from '../../../common/models/search-result';
import { UserDto } from './dto/user.dto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { getUsersQueryJoiSchema } from './dto/get-users-query.joi-schema';
import { GetUserParamDto } from './dto/get-user-param.dto';
import { getUserParamJoiSchema } from './dto/get-user-param.joi-schema';

@ApiTags('Users')
// The global prefix `api` is applied in main.ts (setGlobalPrefix), so the controller path must
// NOT repeat it — this resolves to `/api/users`, not `/api/api/users`.
@Controller({ path: 'users' })
export class UserApiController {
  //#region Constructor
  public constructor(
    @Inject(JoiServiceInjectionTokens.SERVICE__JOI)
    private readonly __joiService: IJoiService,
    @Inject(UserServiceInjectionTokens.SERVICE__USER)
    private readonly __userService: IUserService,
  ) {}
  //#endregion

  //#region Methods
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List users' })
  @ApiOkResponse({ description: 'An offset-paginated page of users.' })
  public async searchAsync(@Query() query: GetUsersQueryDto): Promise<SearchResult<UserDto>> {
    // 2. Validate request (shape & types) — defaults applied, coerced to numbers.
    const instance = await this.__joiService.validateAsync(query, getUsersQueryJoiSchema);

    // 5. Interact with the database (via the data-access service).
    const result = await this.__userService.searchAsync({
      limit: instance.limit,
      offset: instance.offset,
    });

    return {
      items: result.items.map(UserDto.fromEntity),
      total: result.total,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiOkResponse({ description: 'The requested user.', type: UserDto })
  public async getAsync(@Param() param: GetUserParamDto): Promise<UserDto> {
    // 2. Validate request (shape & types) — missing/malformed id -> 400.
    const instance = await this.__joiService.validateAsync(param, getUserParamJoiSchema);

    // 4/5. Domain check + read: unknown id -> UserByIdNotFoundException (404 USER_NOT_FOUND).
    const user = await this.__userService.getByIdAsync(instance.id);

    return UserDto.fromEntity(user);
  }
  //#endregion
}
