import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  app.enableCors();

  const configService = app.get(ConfigService);

  // API documentation is gated by `API_DOCUMENT__ENABLED` and defaults to off.
  const apiDocumentEnabled = configService.get<boolean>('apiDocument.enabled');
  if (apiDocumentEnabled) {
    const documentConfig = new DocumentBuilder()
      .setTitle('Everfit Workout Logging API')
      .setDescription('Workout logging, history, and personal-record API.')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, documentConfig);
    app.use(
      `/${globalPrefix}/docs`,
      apiReference({ content: document }),
    );
  }

  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port);

  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
  if (apiDocumentEnabled) {
    Logger.log(
      `📖 API reference available at: http://localhost:${port}/${globalPrefix}/docs`,
    );
  }
}

bootstrap();
