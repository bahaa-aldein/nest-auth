import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { ACCESS_TOKEN_COOKIE } from './auth/auth-cookie.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import {
  Environment,
  type EnvironmentVariables,
} from './config/env.validation.js';

const SWAGGER_PATH = 'docs';

export const createValidationPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

function configureSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Nest Auth API')
    .setDescription('Authentication backend API')
    .setVersion('1.0')
    .addCookieAuth(ACCESS_TOKEN_COOKIE, undefined, 'accessToken')
    .build();

  SwaggerModule.setup(
    SWAGGER_PATH,
    app,
    SwaggerModule.createDocument(app, config),
  );
}

export function configureApp(app: INestApplication): void {
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const isProduction =
    config.get('NODE_ENV', { infer: true }) === Environment.Production;

  // The Swagger UI needs inline scripts, so only its routes get a relaxed CSP.
  const apiHelmet = helmet();
  const docsHelmet = helmet({ contentSecurityPolicy: false });

  app.useLogger(new Logger());
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use((req: Request, res: Response, next: NextFunction) =>
    (req.path.startsWith(`/${SWAGGER_PATH}`) ? docsHelmet : apiHelmet)(
      req,
      res,
      next,
    ),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }),
    credentials: true,
  });
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();

  if (!isProduction) configureSwagger(app);
}
