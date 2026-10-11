import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserServiceInjectionTokens } from './user-injection-tokens';
import { UserEntity } from '../../entities/user.entity';
import { TimeContextModule } from '../../../../../common/time-context/time-context.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), TimeContextModule],
  providers: [
    {
      provide: UserServiceInjectionTokens.SERVICE__USER,
      useClass: UserService,
    },
  ],
  exports: [UserServiceInjectionTokens.SERVICE__USER],
})
export class UserServiceModule {}
