import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ExceptionFilterModule } from '../common/filters/exception-filter.module';

@Module({
  imports: [ExceptionFilterModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
