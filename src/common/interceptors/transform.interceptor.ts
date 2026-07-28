import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FastifyReply } from 'fastify';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';

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
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector?: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    const skip = this.reflector?.getAllAndOverride<boolean>(
      SKIP_TRANSFORM_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Raw responses (file downloads, streams) must not be wrapped.
    if (skip) {
      return next.handle();
    }

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
