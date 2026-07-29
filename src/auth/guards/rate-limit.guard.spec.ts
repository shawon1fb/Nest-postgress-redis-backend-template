import { ExecutionContext, HttpException } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { Reflector } from '@nestjs/core';
import {
  ApiRateLimit,
  AuthRateLimit,
  RateLimit,
  RateLimitOptions,
  RATE_LIMIT_KEY,
  StrictApiRateLimit,
} from '../decorators/rate-limit.decorator';
import { RateLimitGuard } from './rate-limit.guard';

const contextWith = (request: Record<string, unknown> = {}): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers: {}, ...request }) }),
    getHandler: () => ({ name: 'login' }),
    getClass: () => ({ name: 'AuthController' }),
  }) as unknown as ExecutionContext;

describe('RateLimitGuard', () => {
  const cache = { get: jest.fn(), set: jest.fn() };

  const guardFor = (options: RateLimitOptions | undefined) =>
    new RateLimitGuard(
      { getAllAndOverride: () => options } as unknown as Reflector,
      cache as unknown as Cache,
    );

  afterEach(() => jest.clearAllMocks());

  it('skips routes that declare no limit', async () => {
    await expect(guardFor(undefined).canActivate(contextWith())).resolves.toBe(
      true,
    );
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('allows a request below the limit and counts it', async () => {
    cache.get.mockResolvedValue(2);

    await expect(
      guardFor({ ttl: 60, limit: 5 }).canActivate(contextWith()),
    ).resolves.toBe(true);
    expect(cache.set).toHaveBeenCalledWith(expect.any(String), 3, 60000);
  });

  it('treats a missing counter as zero', async () => {
    cache.get.mockResolvedValue(undefined);

    await expect(
      guardFor({ ttl: 60, limit: 1 }).canActivate(contextWith()),
    ).resolves.toBe(true);
    expect(cache.set).toHaveBeenCalledWith(expect.any(String), 1, 60000);
  });

  it('rejects once the limit is reached', async () => {
    cache.get.mockResolvedValue(5);

    await expect(
      guardFor({ ttl: 60, limit: 5 }).canActivate(contextWith()),
    ).rejects.toBeInstanceOf(HttpException);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('reports the retry window in the error body', async () => {
    cache.get.mockResolvedValue(10);

    await expect(
      guardFor({ ttl: 900, limit: 5 }).canActivate(contextWith()),
    ).rejects.toMatchObject({
      response: { statusCode: 429, retryAfter: 900 },
    });
  });

  describe('bucket key', () => {
    const keyFor = async (request: Record<string, unknown>) => {
      cache.set.mockClear();
      cache.get.mockResolvedValue(0);
      await guardFor({ ttl: 60, limit: 5 }).canActivate(contextWith(request));
      return (cache.set.mock.calls.at(-1) as [string])[0];
    };

    it('scopes the bucket to controller and handler', async () => {
      await expect(keyFor({ ip: '1.2.3.4' })).resolves.toContain(
        'rate_limit:AuthController:login:',
      );
    });

    it('prefers the forwarded client IP', async () => {
      await expect(
        keyFor({ headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } }),
      ).resolves.toContain('9.9.9.9');
    });

    it('falls back through x-real-ip and socket address', async () => {
      await expect(
        keyFor({ headers: { 'x-real-ip': '8.8.8.8' } }),
      ).resolves.toContain('8.8.8.8');
      await expect(
        keyFor({ socket: { remoteAddress: '7.7.7.7' } }),
      ).resolves.toContain('7.7.7.7');
    });

    it('uses "unknown" when no address can be determined', async () => {
      await expect(keyFor({})).resolves.toContain('unknown');
    });

    it('buckets by API key when one is present', async () => {
      await expect(
        keyFor({ headers: { 'x-api-key': 'key-abc' }, ip: '1.2.3.4' }),
      ).resolves.toContain('key-abc');
    });

    it('buckets by bearer token when there is no API key', async () => {
      await expect(
        keyFor({ headers: { authorization: 'Bearer tok-xyz' } }),
      ).resolves.toContain('tok-xyz');
    });
  });
});

describe('rate limit decorators', () => {
  const metadataOf = (decorate: () => MethodDecorator) => {
    class Target {
      handler() {}
    }
    decorate()(Target.prototype, 'handler', {
      value: Target.prototype.handler,
    });
    return Reflect.getMetadata(
      RATE_LIMIT_KEY,
      Target.prototype.handler,
    ) as RateLimitOptions;
  };

  it('RateLimit stores the options verbatim', () => {
    expect(metadataOf(() => RateLimit({ ttl: 30, limit: 3 }))).toEqual({
      ttl: 30,
      limit: 3,
    });
  });

  it('ApiRateLimit is the permissive default', () => {
    expect(metadataOf(ApiRateLimit)).toEqual({ ttl: 60, limit: 100 });
  });

  it('StrictApiRateLimit is tighter than the default', () => {
    expect(metadataOf(StrictApiRateLimit).limit).toBeLessThan(
      metadataOf(ApiRateLimit).limit,
    );
  });

  it('AuthRateLimit only counts failed attempts', () => {
    expect(metadataOf(AuthRateLimit)).toMatchObject({
      ttl: 900,
      limit: 5,
      skipSuccessfulRequests: true,
    });
  });
});
