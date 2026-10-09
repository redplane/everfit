import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ExceptionFilterModule } from '../common/filters/exception-filter.module';
import { TimeContextModule } from '../common/time-context/time-context.module';
import { JoiServiceModule } from '../common/services/joi/joi.module';
import { UserApiModule } from '../modules/apis/user/user-api.module';
import { databaseConfig } from '../common/config/database.config';
import { apiDocumentConfig } from '../common/config/api-document.config';
import { envValidationJoiSchema } from '../common/config/env-validation.joi-schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // `.env.api.local` (git-ignored overrides) takes precedence over the committed-style
      // `.env.api`; real values live in `.env.api`, documented by `.env.api.example`.
      envFilePath: ['.env.api.local', '.env.api'],
      load: [databaseConfig, apiDocumentConfig],
      validationSchema: envValidationJoiSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.name'),
        synchronize: false,
        autoLoadEntities: true,
      }),
    }),
    TimeContextModule,
    JoiServiceModule,
    ExceptionFilterModule,
    UserApiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
