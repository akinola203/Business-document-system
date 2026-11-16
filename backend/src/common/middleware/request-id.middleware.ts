import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { trace, context } from '@opentelemetry/api';

export const REQUEST_ID_HEADER = 'x-request-id';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const rawRequestId = req.headers[REQUEST_ID_HEADER] || req.headers['x-correlation-id'];
    const requestId =
      typeof rawRequestId === 'string' && rawRequestId.trim().length > 0
        ? rawRequestId.trim()
        : crypto.randomUUID();

    req.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    // Propagate request ID into active OpenTelemetry span for distributed correlation
    try {
      const activeSpan = trace.getSpan(context.active());
      if (activeSpan) {
        activeSpan.setAttribute('http.request_id', requestId);
        activeSpan.setAttribute('app.request_id', requestId);
      }
    } catch {
      // In case tracing is not active, continue cleanly
    }

    next();
  }
}
