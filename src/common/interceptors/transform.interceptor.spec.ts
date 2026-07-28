import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';
import { PaginatedResponseDto } from '../dto';

const contextWithStatus = (statusCode: number) =>
  ({
    switchToHttp: () => ({
      getResponse: () => ({ statusCode }),
    }),
  }) as unknown as ExecutionContext;

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
      message: 'Success',
      data: { id: '1' },
    });
  });

  it('hoists message-only results and nulls data', async () => {
    await expect(
      run({ message: 'User deleted successfully' }),
    ).resolves.toEqual({
      success: true,
      statusCode: 200,
      message: 'User deleted successfully',
      data: null,
    });
  });

  it('flattens PaginatedResponseDto to sibling data/meta', async () => {
    const paginated = PaginatedResponseDto.create([{ id: '1' }], 25, 2, 10);

    await expect(run(paginated)).resolves.toEqual({
      success: true,
      statusCode: 200,
      message: 'Success',
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
      message: 'Success',
      data: null,
    });
  });
});
