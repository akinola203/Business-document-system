import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

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
      this.logger.error(`Unhandled Exception: ${exception.message}`, exception.stack);
      // In production, do not leak internal system stack traces
      if (process.env.NODE_ENV !== 'production') {
        message = exception.message;
      }
    }

    const errorPayload = {
      success: false,
      statusCode,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(errorPayload);
  }
}
