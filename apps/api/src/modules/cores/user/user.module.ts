import { Module } from '@nestjs/common';
import { UserServiceModule } from './services/user/user.service.module';
import { UserServiceInjectionTokens } from './services/user/user-injection-tokens';

/**
 * Core module for user master data (F2). Bundles the user service and re-exports the
 * `SERVICE__USER` token so downstream read features (F5–F8) can inject `IUserService` to validate
 * user existence.
 */
@Module({
  imports: [UserServiceModule],
  exports: [UserServiceInjectionTokens.SERVICE__USER],
})
export class UserModule {}
