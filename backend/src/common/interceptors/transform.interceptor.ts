import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseEnvelope<T> {
  success: boolean;
  data: T;
  meta?: any;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ResponseEnvelope<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ResponseEnvelope<T>> {
    return next.handle().pipe(
      map((res) => {
        // Handle responses that already include meta or are standard objects
        if (res && typeof res === 'object') {
          if ('data' in res && 'meta' in res) {
            return {
              success: true,
              data: res.data,
              meta: res.meta,
            };
          }
          if ('items' in res && 'meta' in res) {
            return {
              success: true,
              data: res.items,
              meta: res.meta,
            };
          }
        }
        return {
          success: true,
          data: res,
        };
      }),
    );
  }
}
