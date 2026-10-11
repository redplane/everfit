import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IJoiService } from '../../../common/services/joi/joi-service.interface';
import { JoiServiceInjectionTokens } from '../../../common/services/joi/joi-injection-tokens';
import { IWorkoutLoggingService } from './services/workout-logging/workout-logging-service.interface';
import { WorkoutLoggingServiceInjectionTokens } from './services/workout-logging/workout-logging-injection-tokens';
import { CreateWorkoutPayloadDto } from './dto/create-workout-payload.dto';
import { createWorkoutPayloadJoiSchema } from './dto/create-workout-payload.joi-schema';
import { LogWorkoutResultDto } from './dto/log-workout-result.dto';

@ApiTags('Workouts')
// The global prefix `api` is applied in main.ts (setGlobalPrefix), so the controller path must NOT
// repeat it — this resolves to `/api/workout`, not `/api/api/workout`.
@Controller({ path: 'workout' })
export class WorkoutApiController {
  //#region Constructor
  public constructor(
    @Inject(JoiServiceInjectionTokens.SERVICE__JOI)
    private readonly __joiService: IJoiService,
    @Inject(WorkoutLoggingServiceInjectionTokens.SERVICE__WORKOUT_LOGGING)
    private readonly __workoutLoggingService: IWorkoutLoggingService,
  ) {}
  //#endregion

  //#region Methods
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Log a workout' })
  @ApiCreatedResponse({
    description: 'The workout was logged (single or bulk) as row-per-set records.',
  })
  public async createAsync(
    @Body() payload: CreateWorkoutPayloadDto,
  ): Promise<LogWorkoutResultDto> {
    // 2. Validate request (shape & types).
    const instance = await this.__joiService.validateAsync(payload, createWorkoutPayloadJoiSchema);

    // 3–5. Domain checks, normalization, and the atomic write are orchestrated by the logging service.
    const entries = await this.__workoutLoggingService.logAsync(instance);

    return LogWorkoutResultDto.fromEntities(entries);
  }
  //#endregion
}
