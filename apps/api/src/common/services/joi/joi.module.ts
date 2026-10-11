import { Module } from '@nestjs/common';
import { JoiService } from './joi.service';
import { JoiServiceInjectionTokens } from './joi-injection-tokens';

@Module({
  providers: [
    {
      provide: JoiServiceInjectionTokens.SERVICE__JOI,
      useClass: JoiService,
    },
  ],
  exports: [JoiServiceInjectionTokens.SERVICE__JOI],
})
export class JoiServiceModule {}
