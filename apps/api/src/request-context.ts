import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export interface RequestMetadata {
  correlationId: string;
  ip?: string;
  userAgent?: string;
  method: string;
  path: string;
}

const storage = new AsyncLocalStorage<RequestMetadata>();

export function requestMetadata() {
  return storage.getStore();
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const supplied = request.header('x-correlation-id');
    const correlationId =
      supplied && /^[a-zA-Z0-9._:-]{8,128}$/.test(supplied) ? supplied : randomUUID();
    response.setHeader('x-correlation-id', correlationId);
    storage.run(
      {
        correlationId,
        ip: request.ip,
        userAgent: request.header('user-agent'),
        method: request.method,
        path: request.originalUrl,
      },
      next,
    );
  }
}
