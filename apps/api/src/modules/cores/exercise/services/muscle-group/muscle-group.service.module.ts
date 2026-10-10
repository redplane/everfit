import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MuscleGroupService } from './muscle-group.service';
import { MuscleGroupServiceInjectionTokens } from './muscle-group-injection-tokens';
import { MuscleGroupEntity } from '../../entities/muscle-group.entity';
import { TimeContextModule } from '../../../../../common/time-context/time-context.module';

@Module({
  imports: [TypeOrmModule.forFeature([MuscleGroupEntity]), TimeContextModule],
  providers: [
    {
      provide: MuscleGroupServiceInjectionTokens.SERVICE__MUSCLE_GROUP,
      useClass: MuscleGroupService,
    },
  ],
  exports: [MuscleGroupServiceInjectionTokens.SERVICE__MUSCLE_GROUP],
})
export class MuscleGroupServiceModule {}
