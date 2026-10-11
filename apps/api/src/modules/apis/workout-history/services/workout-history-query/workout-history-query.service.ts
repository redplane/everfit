import { Inject, Injectable } from '@nestjs/common';
import { IWorkoutHistoryQueryService } from './workout-history-query-service.interface';
import { decodeCursor, encodeCursor } from './workout-history-cursor.codec';
import { GetWorkoutHistoryQueryDto } from '../../dto/get-workout-history-query.dto';
import { WorkoutHistoryItemDto } from '../../dto/workout-history-item.dto';
import { WorkoutHistorySetDto } from '../../dto/workout-history-set.dto';
import { IUserService } from '../../../../cores/user/services/user/user-service.interface';
import { UserServiceInjectionTokens } from '../../../../cores/user/services/user/user-injection-tokens';
import { UserByIdNotFoundException } from '../../../../cores/user/exceptions/user-by-id-not-found.exception';
import { IExerciseService } from '../../../../cores/exercise/services/exercise/exercise-service.interface';
import { ExerciseServiceInjectionTokens } from '../../../../cores/exercise/services/exercise/exercise-injection-tokens';
import { IScaleUnitConversionService } from '../../../../cores/scale-unit/services/scale-unit-conversion/scale-unit-conversion-service.interface';
import { ScaleUnitConversionServiceInjectionTokens } from '../../../../cores/scale-unit/services/scale-unit-conversion/scale-unit-conversion-injection-tokens';
import { IWorkoutService } from '../../../../cores/workout/services/workout/workout-service.interface';
import { WorkoutServiceInjectionTokens } from '../../../../cores/workout/services/workout/workout-injection-tokens';
import { WorkoutEntryEntity } from '../../../../cores/workout/entities/workout-entry.entity';
import { WorkoutSetEntity } from '../../../../cores/workout/entities/workout-set.entity';
import { WorkoutHistorySearchCriteria } from '../../../../../models/criteria/workout-history-search-criteria';
import { SearchResult } from '../../../../../common/models/search-result';
import { ValidationException } from '../../../../../common/exceptions/validation.exception';
import { ValidationIssue } from '../../../../../common/models/validation-issue';

@Injectable()
export class WorkoutHistoryQueryService implements IWorkoutHistoryQueryService {
  //#region Constructor
  public constructor(
    @Inject(UserServiceInjectionTokens.SERVICE__USER)
    private readonly __userService: IUserService,
    @Inject(ExerciseServiceInjectionTokens.SERVICE__EXERCISE)
    private readonly __exerciseService: IExerciseService,
    @Inject(ScaleUnitConversionServiceInjectionTokens.SERVICE__SCALE_UNIT_CONVERSION)
    private readonly __scaleUnitConversionService: IScaleUnitConversionService,
    @Inject(WorkoutServiceInjectionTokens.SERVICE__WORKOUT)
    private readonly __workoutService: IWorkoutService,
  ) {}
  //#endregion

  //#region Methods
  public async searchAsync(
    query: GetWorkoutHistoryQueryDto,
  ): Promise<SearchResult<WorkoutHistoryItemDto>> {
    // 4a. Domain check — the user must exist.
    const userExists = await this.__userService.existsByIdAsync(query.userId);
    if (!userExists) {
      throw new UserByIdNotFoundException(query.userId);
    }

    // 4b. Resolve the exercise-name / muscle-group filters to an exercise-id set (AND-combined). A
    // resolved-but-empty set means "no matching data" → an empty page, not an error.
    const exerciseIds = await this.__resolveExerciseIdsAsync(query);
    if (exerciseIds !== undefined && exerciseIds.length === 0) {
      return this.__emptyResult(query.limit);
    }

    // 4c. Decode the keyset cursor (if any). A malformed cursor is a 400 validation error.
    const cursor = this.__decodeCursorOrThrow(query.cursor);

    // 5. Keyset query against the (user_id, performed_at DESC, id DESC) index.
    const criteria: WorkoutHistorySearchCriteria = {
      userId: query.userId,
      exerciseIds,
      from: query.from === undefined ? undefined : new Date(query.from),
      to: query.to === undefined ? undefined : new Date(query.to),
      cursor,
      limit: query.limit,
    };
    const page = await this.__workoutService.searchHistoryAsync(criteria);

    // Resolve exercise names for the page in one query (no N+1), then convert weights.
    const exerciseNameById = await this.__resolveExerciseNamesAsync(page.items);
    const items = await Promise.all(
      page.items.map((entry) => this.__toItemAsync(entry, exerciseNameById, query.unit)),
    );

    const nextCursor =
      page.hasMore
        ? encodeCursor({
            performedAt: page.items[page.items.length - 1].performedAt,
            id: page.items[page.items.length - 1].id,
          })
        : null;

    return { items, limit: query.limit, nextCursor };
  }
  //#endregion

  //#region Helpers
  /**
   * Resolves the partial-name and/or muscle-group filters to a single exercise-id set, intersecting
   * them when both are present (AND). Returns `undefined` when neither filter is applied.
   */
  private async __resolveExerciseIdsAsync(
    query: GetWorkoutHistoryQueryDto,
  ): Promise<string[] | undefined> {
    let ids: string[] | undefined;

    if (query.exerciseName !== undefined) {
      ids = await this.__exerciseService.resolveIdsByNameLikeAsync(query.exerciseName);
    }

    if (query.muscleGroupId !== undefined) {
      const byMuscleGroup = await this.__exerciseService.resolveIdsByMuscleGroupIdAsync(
        query.muscleGroupId,
      );
      ids = ids === undefined ? byMuscleGroup : ids.filter((id) => byMuscleGroup.includes(id));
    }

    return ids;
  }

  /** Decodes the cursor, raising a `ValidationException` (400) for a malformed value. */
  private __decodeCursorOrThrow(raw: string | undefined): { performedAt: Date; id: string } | undefined {
    if (raw === undefined) {
      return undefined;
    }

    const decoded = decodeCursor(raw);
    if (decoded === null) {
      throw new ValidationException([new ValidationIssue('"cursor" is invalid or malformed')]);
    }

    return decoded;
  }

  /** Builds an id→name map for the distinct exercises on the page in one query. */
  private async __resolveExerciseNamesAsync(
    entries: WorkoutEntryEntity[],
  ): Promise<Map<string, string>> {
    const exerciseIds = [...new Set(entries.map((entry) => entry.exerciseId))];
    const exercises = await this.__exerciseService.getByIdsAsync(exerciseIds);

    return new Map(exercises.map((exercise) => [exercise.id, exercise.name]));
  }

  /** Maps a workout entry to its history item DTO, converting each set's weight to the output unit. */
  private async __toItemAsync(
    entry: WorkoutEntryEntity,
    exerciseNameById: Map<string, string>,
    unit: string,
  ): Promise<WorkoutHistoryItemDto> {
    const sets = await Promise.all(
      (entry.sets ?? []).map((set) => this.__toSetAsync(set, unit)),
    );

    return new WorkoutHistoryItemDto(
      entry.id,
      entry.exerciseId,
      exerciseNameById.get(entry.exerciseId) ?? '',
      entry.performedAt,
      unit,
      sets,
    );
  }

  /** Maps a workout set to its DTO, converting the stored base weight to the requested output unit. */
  private async __toSetAsync(set: WorkoutSetEntity, unit: string): Promise<WorkoutHistorySetDto> {
    const weight = await this.__scaleUnitConversionService.fromBaseAsync(set.weightKg, unit);

    return new WorkoutHistorySetDto(set.setNumber, set.reps, weight, set.weight, set.unit);
  }

  /** Builds an empty result (no items, no next cursor) that still echoes the served `limit`. */
  private __emptyResult(limit: number): SearchResult<WorkoutHistoryItemDto> {
    return { items: [], limit, nextCursor: null };
  }
  //#endregion
}
