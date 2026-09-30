import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorMonitoringService } from './observability';
import { requestMetadata } from './request-context';
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly monitoring: ErrorMonitoringService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail = exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      typeof detail === 'string' ? detail : (detail as any)?.message || 'Erro interno do servidor';
    const correlationId = requestMetadata()?.correlationId;
    if (status >= 500) {
      this.monitoring.capture(exception, {
        correlationId,
        method: request.method,
        path: request.url.split('?')[0],
        statusCode: status,
      });
    }
    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
}
