import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { v7 as uuidv7 } from 'uuid';
import { IUserService } from './user-service.interface';
import { UserEntity } from '../../entities/user.entity';
import { UserByIdNotFoundException } from '../../exceptions/user-by-id-not-found.exception';
import { CreateUserOptions } from '../../../../../models/options/create-user-options';
import { UserSearchCriteria } from '../../../../../models/criteria/user-search-criteria';
import { SearchResult } from '../../../../../common/models/search-result';
import { ITimeContext } from '../../../../../common/time-context/time-context.interface';
import { TimeContextInjectionTokens } from '../../../../../common/time-context/time-context-injection-tokens';

@Injectable()
export class UserService implements IUserService {
  //#region Constructor
  public constructor(
    @InjectRepository(UserEntity)
    private readonly __userRepository: Repository<UserEntity>,
    @Inject(TimeContextInjectionTokens.CONTEXT__TIME)
    private readonly __timeContext: ITimeContext,
  ) {}
  //#endregion

  //#region Methods
  public async getByIdAsync(id: string): Promise<UserEntity> {
    const user = await this.__userRepository.findOneBy({ id });

    if (user === null) {
      throw new UserByIdNotFoundException(id);
    }

    return user;
  }

  public async existsByIdAsync(id: string): Promise<boolean> {
    return this.__userRepository.existsBy({ id });
  }

  public async searchAsync(criteria: UserSearchCriteria): Promise<SearchResult<UserEntity>> {
    const [items, total] = await this.__userRepository.findAndCount({
      order: { name: 'ASC', id: 'ASC' },
      take: criteria.limit,
      skip: criteria.offset,
    });

    return {
      items,
      total,
    };
  }

  public async createAsync(options: CreateUserOptions): Promise<UserEntity> {
    const now = await this.__timeContext.getUtcNowAsync();
    const user = new UserEntity(uuidv7(), options.name, now);

    return this.__userRepository.save(user);
  }
  //#endregion
}
