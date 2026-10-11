import { Inject, Injectable } from '@nestjs/common';
import { ILike, In, QueryFailedError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { v7 as uuidv7 } from 'uuid';
import { IExerciseService } from './exercise-service.interface';
import { ExerciseEntity } from '../../entities/exercise.entity';
import { ExerciseMuscleGroupEntity } from '../../entities/exercise-muscle-group.entity';
import { ExerciseByIdNotFoundException } from '../../exceptions/exercise-by-id-not-found.exception';
import { ExerciseMuscleGroupAlreadyExistsException } from '../../exceptions/exercise-muscle-group-already-exists.exception';
import { CreateExerciseOptions } from '../../../../../models/options/create-exercise-options';
import { ExerciseSearchCriteria } from '../../../../../models/criteria/exercise-search-criteria';
import { SearchResult } from '../../../../../common/models/search-result';
import { ITimeContext } from '../../../../../common/time-context/time-context.interface';
import { TimeContextInjectionTokens } from '../../../../../common/time-context/time-context-injection-tokens';

/** Postgres SQLSTATE for a unique-constraint violation. */
const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class ExerciseService implements IExerciseService {
  //#region Constructor
  public constructor(
    @InjectRepository(ExerciseEntity)
    private readonly __exerciseRepository: Repository<ExerciseEntity>,
    @InjectRepository(ExerciseMuscleGroupEntity)
    private readonly __exerciseMuscleGroupRepository: Repository<ExerciseMuscleGroupEntity>,
    @Inject(TimeContextInjectionTokens.CONTEXT__TIME)
    private readonly __timeContext: ITimeContext,
  ) {}
  //#endregion

  //#region Methods
  public async getByIdAsync(id: string): Promise<ExerciseEntity> {
    const exercise = await this.__exerciseRepository.findOneBy({ id });

    if (exercise === null) {
      throw new ExerciseByIdNotFoundException(id);
    }

    return exercise;
  }

  public async existsByIdAsync(id: string): Promise<boolean> {
    return this.__exerciseRepository.existsBy({ id });
  }

  public async getByIdsAsync(ids: string[]): Promise<ExerciseEntity[]> {
    if (ids.length === 0) {
      return [];
    }

    const distinctIds = [...new Set(ids)];

    return this.__exerciseRepository.find({ where: { id: In(distinctIds) } });
  }

  public async searchAsync(
    criteria: ExerciseSearchCriteria,
  ): Promise<SearchResult<ExerciseEntity>> {
    // Page the exercises first (no join), so offset pagination stays correct and does not fan out
    // over the to-many mapping; the mapped muscle groups are then loaded for the page below.
    const query = this.__exerciseRepository.createQueryBuilder('exercise');

    if (criteria.name !== undefined) {
      query.andWhere('exercise.name ILIKE :name', { name: `%${criteria.name}%` });
    }

    if (criteria.muscleGroupId !== undefined) {
      query.andWhere(
        'exercise.id IN (SELECT mapping.exercise_id FROM exercise_muscle_groups mapping ' +
          'WHERE mapping.muscle_group_id = :muscleGroupId)',
        { muscleGroupId: criteria.muscleGroupId },
      );
    }

    query
      .orderBy('exercise.name', 'ASC')
      .addOrderBy('exercise.id', 'ASC')
      .skip(criteria.offset)
      .take(criteria.limit);

    const [items, total] = await query.getManyAndCount();

    await this.__attachMuscleGroupsAsync(items);

    return {
      items,
      total,
    };
  }

  public async resolveIdsByNameLikeAsync(term: string): Promise<string[]> {
    const rows = await this.__exerciseRepository.find({
      where: { name: ILike(`%${term}%`) },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }

  public async resolveIdsByMuscleGroupIdAsync(muscleGroupId: string): Promise<string[]> {
    const rows = await this.__exerciseMuscleGroupRepository.find({
      where: { muscleGroupId },
      select: { exerciseId: true },
    });

    return rows.map((row) => row.exerciseId);
  }

  public async createAsync(options: CreateExerciseOptions): Promise<ExerciseEntity> {
    const now = await this.__timeContext.getUtcNowAsync();
    const exercise = new ExerciseEntity(uuidv7(), options.name, now);

    return this.__exerciseRepository.save(exercise);
  }

  public async mapMuscleGroupAsync(
    exerciseId: string,
    muscleGroupId: string,
  ): Promise<ExerciseMuscleGroupEntity> {
    const now = await this.__timeContext.getUtcNowAsync();
    const mapping = new ExerciseMuscleGroupEntity(uuidv7(), exerciseId, muscleGroupId, now);

    try {
      return await this.__exerciseMuscleGroupRepository.save(mapping);
    } catch (error) {
      if (this.__isUniqueViolation(error)) {
        throw new ExerciseMuscleGroupAlreadyExistsException(exerciseId, muscleGroupId);
      }

      throw error;
    }
  }
  //#endregion

  //#region Helpers
  /**
   * Loads the mapped muscle groups for a page of exercises in one query and attaches them, so the
   * response projection can include each exercise's muscle groups without an N+1.
   */
  private async __attachMuscleGroupsAsync(exercises: ExerciseEntity[]): Promise<void> {
    if (exercises.length === 0) {
      return;
    }

    const exerciseIds = exercises.map((exercise) => exercise.id);
    const mappings = await this.__exerciseMuscleGroupRepository.find({
      where: { exerciseId: In(exerciseIds) },
      relations: { muscleGroup: true },
    });

    for (const exercise of exercises) {
      exercise.exerciseMuscleGroups = mappings.filter(
        (mapping) => mapping.exerciseId === exercise.id,
      );
    }
  }

  /**
   * Whether the error is a Postgres unique-constraint violation (SQLSTATE 23505), checked across the
   * shapes TypeORM / the driver can surface it in.
   */
  private __isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as { code?: string } | undefined;

    return (
      (error as unknown as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION ||
      driverError?.code === POSTGRES_UNIQUE_VIOLATION
    );
  }
  //#endregion
}
