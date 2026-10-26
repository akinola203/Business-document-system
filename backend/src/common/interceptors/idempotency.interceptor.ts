import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of, from } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { IdempotencyService } from '../../modules/idempotency/idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const idempotencyKey =
      (req.headers['idempotency-key'] as string) ||
      (req.headers['x-idempotency-key'] as string);

    // If no idempotency header is provided, proceed with normal execution
    if (!idempotencyKey || !req.user || !req.user.companyId) {
      return next.handle();
    }

    const { companyId, id: userId } = req.user;
    const endpoint = req.originalUrl || req.url;

    return from(
      this.idempotencyService.lockKey(companyId, userId, endpoint, idempotencyKey, req.body),
    ).pipe(
      switchMap((lockResult) => {
        if (lockResult.isCached) {
          // Replay cached response
          res.status(lockResult.status || 200);
          res.setHeader('X-Cache-Lookup', 'HIT');
          return of(lockResult.body);
        }

        return next.handle().pipe(
          tap((responseBody) => {
            const statusCode = res.statusCode || 200;
            // Background save cached response
            this.idempotencyService.saveResponse(companyId, idempotencyKey, statusCode, responseBody);
          }),
          catchError((err) => {
            // Release lock if execution failed so client can retry
            return from(this.idempotencyService.releaseKey(companyId, idempotencyKey)).pipe(
              switchMap(() => {
                throw err;
              }),
            );
          }),
        );
      }),
    );
  }
}
