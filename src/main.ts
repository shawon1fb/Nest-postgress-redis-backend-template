import { NestFactory, Reflector } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import compression from '@fastify/compress';
import multipart from '@fastify/multipart';
import {
  CustomValidationPipe,
  GlobalExceptionFilter,
  TransformInterceptor,
} from './common';
import { SwaggerConfig } from './config/swagger.config';
import { StorageConfig } from './config/storage.config';
import { AppConfig } from './config/app.config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ParameterObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  await app.register(compression);

  // Get Swagger configuration
  const swaggerConfig = app.get(SwaggerConfig);
  const storageConfig = app.get(StorageConfig);
  const appConfig = app.get(AppConfig);

  // File uploads. The limit is enforced again in StorageService so the rule
  // holds for callers that bypass HTTP (queues, seeders).
  await app.register(multipart, {
    limits: { fileSize: storageConfig.maxFileSize, files: 1 },
  });

  // Global request logging
  // app.useGlobalInterceptors(new LoggingInterceptor());

  // Apply global security measures
  app.useGlobalPipes(new CustomValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));

  // Enable CORS for API endpoints
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',') || false
        : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  });

  // Register Swagger documentation
  if (swaggerConfig.enabled) {
    const xLangHeader: ParameterObject = {
      name: 'x-lang',
      in: 'header',
      description:
        'Preferred response language (e.g. `en`, `bn`). Falls back to the server default when omitted or unsupported.',
      required: false,
      schema: { type: 'string', example: 'en' },
    };

    const config = new DocumentBuilder()
      .setTitle(swaggerConfig.title)
      .setDescription(swaggerConfig.description)
      .setVersion(swaggerConfig.version)
      .setContact(
        swaggerConfig.contactName,
        swaggerConfig.contactEmail,
        swaggerConfig.contactEmail,
      )
      .addBearerAuth()
      .addGlobalParameters(xLangHeader)
      .addTag('default')
      .build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(swaggerConfig.path, app, documentFactory, {
      jsonDocumentUrl: swaggerConfig.path + '/json',
    });
  }
  // Log all available routes using Fastify's onRoute hook
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRoute', (opts) => {
      console.log(`Route registered: ${opts.method} ${opts.url}`);
    });

  // Bind to all interfaces by default: the Fastify adapter listens on
  // 127.0.0.1 when no host is given, which makes the app unreachable from
  // outside a container even though it is running fine inside it.
  await app.listen(appConfig.port, process.env.HOST ?? '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log('All routes have been logged above during registration.');
}
bootstrap();
