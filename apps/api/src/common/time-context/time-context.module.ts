import { Module } from '@nestjs/common';
import { TimeContext } from './time-context';
import { TimeContextInjectionTokens } from './time-context-injection-tokens';

@Module({
  providers: [
    {
      provide: TimeContextInjectionTokens.CONTEXT__TIME,
      useClass: TimeContext,
    },
  ],
  exports: [TimeContextInjectionTokens.CONTEXT__TIME],
})
export class TimeContextModule {}
