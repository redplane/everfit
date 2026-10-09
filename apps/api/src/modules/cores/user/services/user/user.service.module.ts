import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserServiceInjectionTokens } from './user-injection-tokens';
import { UserEntity } from '../../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [
    {
      provide: UserServiceInjectionTokens.SERVICE__USER,
      useClass: UserService,
    },
  ],
  exports: [UserServiceInjectionTokens.SERVICE__USER],
})
export class UserServiceModule {}
