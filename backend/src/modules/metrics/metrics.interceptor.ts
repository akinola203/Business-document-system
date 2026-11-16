import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<Request>();
    const res = httpContext.getResponse<Response>();

    const startTime = process.hrtime();
    const method = req.method;

    return next.handle().pipe(
      tap({
        next: () => {
          this.recordMetric(req, res, method, startTime);
        },
        error: (err) => {
          const status = err?.status || err?.statusCode || 500;
          this.recordMetric(req, res, method, startTime, status);
        },
      }),
    );
  }

  private recordMetric(
    req: Request,
    res: Response,
    method: string,
    startTime: [number, number],
    explicitStatus?: number,
  ): void {
    const route = this.resolveRoutePath(req);

    // Prevent recursive scraping amplification
    if (
      route === '/metrics' ||
      route === '/api/v1/metrics' ||
      route.startsWith('/metrics') ||
      route.startsWith('/api/v1/metrics')
    ) {
      return;
    }

    const [seconds, nanoseconds] = process.hrtime(startTime);
    const durationSeconds = seconds + nanoseconds / 1e9;
    const statusCode = String(explicitStatus || res.statusCode || 200);

    this.metricsService.recordHttpRequest(method, route, statusCode, durationSeconds);
  }

  private resolveRoutePath(req: any): string {
    if (req.route?.path) {
      const prefix = req.baseUrl || '';
      return `${prefix}${req.route.path}`;
    }
    return req.path || req.url || 'unknown';
  }
}

