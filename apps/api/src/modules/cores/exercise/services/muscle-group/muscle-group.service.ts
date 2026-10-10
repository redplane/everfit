import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { v7 as uuidv7 } from 'uuid';
import { IMuscleGroupService } from './muscle-group-service.interface';
import { MuscleGroupEntity } from '../../entities/muscle-group.entity';
import { MuscleGroupByIdNotFoundException } from '../../exceptions/muscle-group-by-id-not-found.exception';
import { CreateMuscleGroupOptions } from '../../../../../models/options/create-muscle-group-options';
import { MuscleGroupSearchCriteria } from '../../../../../models/criteria/muscle-group-search-criteria';
import { SearchResult } from '../../../../../common/models/search-result';
import { ITimeContext } from '../../../../../common/time-context/time-context.interface';
import { TimeContextInjectionTokens } from '../../../../../common/time-context/time-context-injection-tokens';

@Injectable()
export class MuscleGroupService implements IMuscleGroupService {
  //#region Constructor
  public constructor(
    @InjectRepository(MuscleGroupEntity)
    private readonly __muscleGroupRepository: Repository<MuscleGroupEntity>,
    @Inject(TimeContextInjectionTokens.CONTEXT__TIME)
    private readonly __timeContext: ITimeContext,
  ) {}
  //#endregion

  //#region Methods
  public async getByIdAsync(id: string): Promise<MuscleGroupEntity> {
    const muscleGroup = await this.__muscleGroupRepository.findOneBy({ id });

    if (muscleGroup === null) {
      throw new MuscleGroupByIdNotFoundException(id);
    }

    return muscleGroup;
  }

  public async existsByIdAsync(id: string): Promise<boolean> {
    return this.__muscleGroupRepository.existsBy({ id });
  }

  public async searchAsync(
    criteria: MuscleGroupSearchCriteria,
  ): Promise<SearchResult<MuscleGroupEntity>> {
    const [items, total] = await this.__muscleGroupRepository.findAndCount({
      order: { name: 'ASC', id: 'ASC' },
      take: criteria.limit,
      skip: criteria.offset,
    });

    return {
      items,
      limit: criteria.limit,
      offset: criteria.offset,
      total,
    };
  }

  public async createAsync(options: CreateMuscleGroupOptions): Promise<MuscleGroupEntity> {
    const now = await this.__timeContext.getUtcNowAsync();
    const muscleGroup = new MuscleGroupEntity(uuidv7(), options.name, now);

    return this.__muscleGroupRepository.save(muscleGroup);
  }
  //#endregion
}
