import { FastifyReply, FastifyRequest } from 'fastify';
import { SanitizationMiddleware } from './sanitization.middleware';
import { SecurityHeadersMiddleware } from './security-headers.middleware';

describe('SecurityHeadersMiddleware', () => {
  const middleware = new SecurityHeadersMiddleware();

  const run = (
    request: Partial<{ headers: Record<string, string>; url: string }> = {},
  ) => {
    const headers: Record<string, unknown> = {};
    const removed: string[] = [];
    const next = jest.fn();

    middleware.use(
      {
        headers: request.headers ?? {},
        url: request.url ?? '/',
      } as unknown as FastifyRequest['raw'],
      {
        setHeader: (name: string, value: unknown) => (headers[name] = value),
        removeHeader: (name: string) => removed.push(name),
      } as unknown as FastifyReply['raw'],
      next,
    );

    return { headers, removed, next };
  };

  it('sets the baseline hardening headers and continues the chain', () => {
    const { headers, next } = run();

    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
    expect(headers['Permissions-Policy']).toContain('camera=()');
    expect(next).toHaveBeenCalled();
  });

  it('hides the framework banner', () => {
    expect(run().removed).toContain('X-Powered-By');
  });

  it('omits HSTS on a plain-HTTP request', () => {
    expect(run().headers['Strict-Transport-Security']).toBeUndefined();
  });

  it('sends HSTS once a proxy reports HTTPS', () => {
    const { headers } = run({ headers: { 'x-forwarded-proto': 'https' } });

    expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
  });

  it('adds CORS headers only under the /api/ prefix', () => {
    expect(
      run({ url: '/auth/login' }).headers['Access-Control-Allow-Origin'],
    ).toBeUndefined();
    expect(
      run({ url: '/api/v1/users' }).headers['Access-Control-Allow-Origin'],
    ).toBe('*');
  });
});

describe('SanitizationMiddleware', () => {
  const middleware = new SanitizationMiddleware();

  const run = (request: Record<string, unknown>) => {
    const next = jest.fn();
    const target = { body: {}, query: {}, params: {}, ...request };

    middleware.use(target as never, {} as never, next);

    return { target, next };
  };

  it('strips script tags from body values', () => {
    const { target } = run({
      body: { bio: 'hello <script>alert(1)</script>world' },
    });

    // The tag and its contents go; the surrounding spacing is preserved.
    expect((target.body as { bio: string }).bio).toBe('hello world');
  });

  it('removes javascript: protocols and inline event handlers', () => {
    const { target } = run({
      body: { link: 'javascript:alert(1)', markup: '<div onclick=steal()>' },
    });

    const body = target.body as { link: string; markup: string };
    expect(body.link).not.toContain('javascript:');
    expect(body.markup).not.toContain('onclick');
  });

  it('strips quotes and SQL comment markers', () => {
    const { target } = run({ body: { name: "Robert'); DROP TABLE users;--" } });

    const name = (target.body as { name: string }).name;
    expect(name).not.toContain("'");
    expect(name).not.toContain('--');
    expect(name).not.toContain(';');
  });

  it('recurses through nested objects and arrays', () => {
    const { target } = run({
      body: {
        profile: { tags: ['<b>one</b>', 'two'], nested: { deep: '<i>x</i>' } },
      },
    });

    const body = target.body as {
      profile: { tags: string[]; nested: { deep: string } };
    };
    expect(body.profile.tags).toEqual(['one', 'two']);
    expect(body.profile.nested.deep).toBe('x');
  });

  it('sanitizes query and route params too', () => {
    const { target } = run({
      query: { search: '<script>x</script>term' },
      params: { id: '<b>42</b>' },
    });

    expect((target.query as { search: string }).search).toBe('term');
    expect((target.params as { id: string }).id).toBe('42');
  });

  it('leaves non-string values intact', () => {
    const { target } = run({
      body: { count: 42, active: true, missing: null, absent: undefined },
    });

    expect(target.body).toMatchObject({
      count: 42,
      active: true,
      missing: null,
    });
  });

  it('always calls next', () => {
    expect(run({}).next).toHaveBeenCalled();
  });
});
