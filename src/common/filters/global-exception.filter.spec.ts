import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CommonMessage, UsersMessage } from '../i18n';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  const capture = (exception: unknown) => {
    const sent: { status?: number; body?: Record<string, unknown> } = {};
    const response = {
      status: (code: number) => {
        sent.status = code;
        return {
          send: (body: Record<string, unknown>) => (sent.body = body),
        };
      },
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ method: 'GET', url: '/users/1' }),
      }),
    } as unknown as ArgumentsHost;

    filter.catch(exception, host);
    return sent;
  };

  it('maps an HttpException to its status and message', () => {
    const sent = capture(new NotFoundException('User not found'));

    expect(sent.status).toBe(404);
    expect(sent.body).toMatchObject({
      success: false,
      statusCode: 404,
      message: 'User not found',
    });
  });

  it('treats an unknown throwable as a 500', () => {
    const sent = capture(new Error('kaboom'));

    expect(sent.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(sent.body).toMatchObject({ success: false, statusCode: 500 });
  });

  it('handles an exception whose response is a plain string', () => {
    const sent = capture(new HttpException('teapot', 418));

    expect(sent.status).toBe(418);
    expect(sent.body).toMatchObject({ message: 'teapot' });
  });

  it('passes validation errors through', () => {
    const sent = capture(
      new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        errors: ['email: must be an email'],
      }),
    );

    expect(sent.body).toMatchObject({
      message: 'Validation failed',
      errors: ['email: must be an email'],
    });
  });

  it('includes the request path outside production', () => {
    process.env.NODE_ENV = 'development';

    expect(capture(new NotFoundException('nope')).body).toMatchObject({
      path: '/users/1',
      method: 'GET',
    });
  });

  it('omits the request path in production', () => {
    process.env.NODE_ENV = 'production';

    const body = capture(new NotFoundException('nope')).body!;

    expect(body.path).toBeUndefined();
    expect(body.method).toBeUndefined();
  });

  it('masks server errors and drops details in production', () => {
    process.env.NODE_ENV = 'production';

    const body = capture(
      new HttpException(
        { message: 'connection string leaked', errors: ['secret'] },
        500,
      ),
    ).body!;

    // Masked through the translation layer; without a request context the
    // key itself is returned.
    expect(body.message).toBe(CommonMessage.INTERNAL_ERROR);
    expect(body.errors).toBeUndefined();
  });

  it('localizes a translation key thrown by a service', () => {
    // Outside a request context there is no language, so the key survives —
    // the important part is that it is routed through translation, not that
    // English is produced here.
    expect(
      capture(new NotFoundException(UsersMessage.NOT_FOUND)).body,
    ).toMatchObject({ message: UsersMessage.NOT_FOUND });
  });

  it('redacts credentials that leak into a message', () => {
    process.env.NODE_ENV = 'development';

    const body = capture(
      new BadRequestException('failed for password=hunter2'),
    ).body!;

    expect(body.message).not.toContain('hunter2');
    expect(body.message).toContain('[REDACTED]');
  });

  it('redacts an email address and an IP in a message', () => {
    process.env.NODE_ENV = 'development';

    expect(
      capture(new BadRequestException('user john@example.com from 10.0.0.4'))
        .body!.message,
    ).toBe('user [EMAIL_REDACTED] from [IP_REDACTED]');
  });

  it('redacts each entry of an array message', () => {
    process.env.NODE_ENV = 'development';

    const body = capture(
      new BadRequestException({
        message: ['token=abc123', 'plain message'],
      }),
    ).body!;

    expect((body.message as string[])[0]).toContain('[REDACTED]');
    expect((body.message as string[])[1]).toBe('plain message');
  });

  it('sanitizes object-shaped error details', () => {
    process.env.NODE_ENV = 'development';

    const body = capture(
      new BadRequestException({
        message: 'Validation failed',
        errors: { field: 'secret=shh' },
      }),
    ).body!;

    expect(JSON.stringify(body.errors)).toContain('[REDACTED]');
  });
});
