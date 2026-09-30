import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import type { NextFunction, Request, Response } from 'express';
import { requestMetadata } from './request-context';

@Injectable()
export class ErrorMonitoringService {
  private readonly enabled = Boolean(process.env.SENTRY_DSN);

  constructor() {
    if (this.enabled) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.APP_ENV || process.env.NODE_ENV || 'development',
        release: process.env.APP_VERSION,
      });
    }
  }

  capture(exception: unknown, context: Record<string, unknown>) {
    if (!this.enabled) return;
    Sentry.withScope((scope) => {
      scope.setContext('request', context);
      Sentry.captureException(exception);
    });
  }

  status() {
    return this.enabled ? 'configured' : 'disabled';
  }
}

@Injectable()
export class StructuredRequestLogger implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction) {
    const startedAt = Date.now();
    response.on('finish', () => {
      const context = requestMetadata();
      this.logger.log(
        JSON.stringify({
          type: 'http_request',
          correlationId: context?.correlationId,
          method: request.method,
          path: request.originalUrl.split('?')[0],
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
        }),
      );
    });
    next();
  }
}
