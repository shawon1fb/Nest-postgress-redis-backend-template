import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FastifyReply } from 'fastify';

function isPaginatedResult(val: any): val is { data: any[]; meta: object } {
  return (
    val !== null &&
    typeof val === 'object' &&
    Array.isArray(val.data) &&
    val.meta !== null &&
    typeof val.meta === 'object'
  );
}

function isMessageOnly(val: any): val is { message: string } {
  return (
    val !== null &&
    typeof val === 'object' &&
    typeof val.message === 'string' &&
    Object.keys(val).length === 1
  );
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    return next.handle().pipe(
      map((data) => {
        const statusCode = response.statusCode;

        if (isMessageOnly(data)) {
          return {
            success: true,
            statusCode,
            message: data.message,
            data: null,
          };
        }

        if (isPaginatedResult(data)) {
          return {
            success: true,
            statusCode,
            message: 'Success',
            data: data.data,
            meta: data.meta,
          };
        }

        return {
          success: true,
          statusCode,
          message: 'Success',
          data,
        };
      }),
    );
  }
}
