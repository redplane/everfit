import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedServiceModule } from './services/seed/seed.service.module';
import { databaseConfig } from '../common/config/database.config';
import { apiDocumentConfig } from '../common/config/api-document.config';
import { envValidationJoiSchema } from '../common/config/env-validation.joi-schema';

/**
 * Root module for the database CLI standalone context (F9). Wires the same `ConfigModule` and
 * `TypeOrmModule` as `AppModule` (so the CLI reads `DATABASE__*` from `.env.api` / `.env.api.local`
 * identically) and imports the seed service. No controllers — the CLI is a developer tool, not an HTTP
 * app, so it is bootstrapped via `NestFactory.createApplicationContext` (no route, no server).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
    SeedServiceModule,
  ],
})
export class CliModule {}
