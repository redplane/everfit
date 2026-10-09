import { Module } from '@nestjs/common';
import { UserApiController } from './user-api.controller';
import { UserModule } from '../../cores/user/user.module';
import { JoiServiceModule } from '../../../common/services/joi/joi.module';

/**
 * API module exposing read-only user discovery endpoints (F2): `GET /api/users` (offset list) and
 * `GET /api/users/:id`. Delegates all logic to the core user service.
 */
@Module({
  imports: [UserModule, JoiServiceModule],
  controllers: [UserApiController],
})
export class UserApiModule {}
