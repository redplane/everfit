import { Module } from '@nestjs/common';
import { UserServiceModule } from './services/user/user.service.module';

/**
 * Core module for user master data (F2). Bundles the user service and re-exports the provider
 * module so downstream read features (F5–F8) can inject `IUserService` (token `SERVICE__USER`) to
 * validate user existence. The token itself is provided by `UserServiceModule`, so this module
 * re-exports that module rather than the token (a module can only export what it provides or a
 * module it imports).
 */
@Module({
  imports: [UserServiceModule],
  exports: [UserServiceModule],
})
export class UserModule {}
