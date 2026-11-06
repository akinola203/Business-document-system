import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        message = resObj.message || exception.message;
        error = resObj.error || exception.name;
      }
    } else if ((exception as any)?.name === 'ZodError') {
      statusCode = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
      const zodErr = exception as any;
      message = Array.isArray(zodErr.issues)
        ? zodErr.issues.map((i: any) => `${i.path.join('.') || 'body'}: ${i.message}`).join(', ')
        : zodErr.message || 'Validation failed';
    } else if ((exception as any)?.code === 'P2002') {
      statusCode = HttpStatus.CONFLICT;
      error = 'Conflict';
      const target = (exception as any)?.meta?.target;
      message = target
        ? `Unique constraint violation on field: ${Array.isArray(target) ? target.join(', ') : target}`
        : 'Unique constraint violation. A record with this identifier already exists.';
    } else if ((exception as any)?.code === 'P2003') {
      statusCode = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
      const fieldName = (exception as any)?.meta?.field_name;
      message = fieldName
        ? `Foreign key constraint failed on field: ${fieldName}`
        : 'Foreign key constraint violation. Referenced record does not exist.';
    } else if ((exception as any)?.code === 'P2025') {
      statusCode = HttpStatus.NOT_FOUND;
      error = 'Not Found';
      message = (exception as any)?.meta?.cause || 'Record not found.';
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled Server Exception: ${exception.message}`, exception.stack);
      if (process.env.NODE_ENV !== 'production') {
        message = exception.message;
      }
    }

    // Filter out client-side 4xx errors (e.g. 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Too Many Requests)
    const isClientError = statusCode >= 400 && statusCode < 500;

    if (!isClientError) {
      // Capture 500 server errors, uncaught exceptions, and critical database drops in Sentry
      Sentry.withScope((scope) => {
        scope.setTag('path', request.url);
        scope.setTag('method', request.method);
        const reqId = request.requestId || request.headers?.['x-request-id'];
        if (reqId) {
          scope.setTag('requestId', String(reqId));
        }
        if ((request as any).user) {
          scope.setUser({
            id: (request as any).user.id,
            email: (request as any).user.email,
            companyId: (request as any).user.companyId,
          });
        }
        scope.setExtra('statusCode', statusCode);

        if (exception instanceof Error) {
          Sentry.captureException(exception);
        } else {
          Sentry.captureMessage(String(exception), 'error');
        }
      });
    }

    if (!response.headersSent) {
      const errorPayload = {
        success: false,
        statusCode,
        error,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId: request.requestId || request.headers?.['x-request-id'],
      };
      response.status(statusCode).json(errorPayload);
    }
  }
}
