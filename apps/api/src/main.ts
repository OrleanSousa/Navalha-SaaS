import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
// CommonJS export: cookie-parser does not expose a callable ESM default at runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import cookieParser = require('cookie-parser');
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { static as serveStatic } from 'express';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './http-exception.filter';
import { ErrorMonitoringService } from './observability';

async function bootstrap() {
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  ) {
    throw new Error('JWT_SECRET deve possuir ao menos 32 caracteres em produção');
  }
  const app = await NestFactory.create(AppModule);
  if (process.env.NODE_ENV === 'production') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }
  app.setGlobalPrefix('api');
  app.use(
    '/uploads',
    serveStatic(process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'), {
      fallthrough: false,
      maxAge: '1d',
    }),
  );
  const webOrigin = process.env.WEB_URL || 'http://localhost:5173';
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', webOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Correlation-Id',
    );
    res.setHeader('Access-Control-Expose-Headers', 'X-Correlation-Id');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.useGlobalFilters(new HttpExceptionFilter(app.get(ErrorMonitoringService)));
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  const config = new DocumentBuilder()
    .setTitle('Navalha SaaS API')
    .setDescription('API multiempresa para gestão de barbearias')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }
  await app.listen(Number(process.env.PORT || 3333));
}
bootstrap();
