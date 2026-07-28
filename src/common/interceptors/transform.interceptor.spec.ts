import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, lastValueFrom } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';
import { PaginatedResponseDto } from '../dto';
import { CommonMessage, UsersMessage } from '../i18n';

const contextWithStatus = (statusCode: number) =>
  ({
    switchToHttp: () => ({
      getResponse: () => ({ statusCode }),
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  }) as unknown as ExecutionContext;

const reflectorReturning = (skip: boolean) =>
  ({ getAllAndOverride: () => skip }) as unknown as Reflector;

const handlerReturning = (value: unknown): CallHandler =>
  ({ handle: () => of(value) }) as CallHandler;

describe('TransformInterceptor', () => {
  const interceptor = new TransformInterceptor();

  const run = (value: unknown, statusCode = 200) =>
    lastValueFrom(
      interceptor.intercept(
        contextWithStatus(statusCode),
        handlerReturning(value),
      ),
    );

  it('wraps an object payload under data', async () => {
    await expect(run({ id: '1' }, 201)).resolves.toEqual({
      success: true,
      statusCode: 201,
      message: CommonMessage.SUCCESS,
      data: { id: '1' },
    });
  });

  it('hoists message-only results and nulls data', async () => {
    await expect(run({ message: UsersMessage.DELETED })).resolves.toEqual({
      success: true,
      statusCode: 200,
      message: UsersMessage.DELETED,
      data: null,
    });
  });

  it('flattens PaginatedResponseDto to sibling data/meta', async () => {
    const paginated = PaginatedResponseDto.create([{ id: '1' }], 25, 2, 10);

    await expect(run(paginated)).resolves.toEqual({
      success: true,
      statusCode: 200,
      message: CommonMessage.SUCCESS,
      data: [{ id: '1' }],
      meta: {
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      },
    });
  });

  it('passes null payloads through as data: null', async () => {
    await expect(run(null)).resolves.toEqual({
      success: true,
      statusCode: 200,
      message: CommonMessage.SUCCESS,
      data: null,
    });
  });

  it('leaves the payload untouched on @SkipTransform() handlers', async () => {
    const raw = new TransformInterceptor(reflectorReturning(true));
    const stream = { pipe: () => undefined };

    await expect(
      lastValueFrom(
        raw.intercept(contextWithStatus(200), handlerReturning(stream)),
      ),
    ).resolves.toBe(stream);
  });

  it('still wraps when the reflector reports no skip metadata', async () => {
    const wrapping = new TransformInterceptor(reflectorReturning(false));

    await expect(
      lastValueFrom(
        wrapping.intercept(contextWithStatus(200), handlerReturning({ a: 1 })),
      ),
    ).resolves.toEqual({
      success: true,
      statusCode: 200,
      message: CommonMessage.SUCCESS,
      data: { a: 1 },
    });
  });
});
