import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import compression from '@fastify/compress';
import {
  CustomValidationPipe,
  GlobalExceptionFilter,
  TransformInterceptor,
} from './common';
import { SwaggerConfig } from './config/swagger.config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  await app.register(compression);

  // Get Swagger configuration
  const swaggerConfig = app.get(SwaggerConfig);

  // Global request logging
  // app.useGlobalInterceptors(new LoggingInterceptor());

  // Apply global security measures
  app.useGlobalPipes(new CustomValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

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

  await app.listen(process.env.PORT ?? 8000);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log('All routes have been logged above during registration.');
}
bootstrap();
