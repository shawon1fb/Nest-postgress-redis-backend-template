import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { UserResponseDto } from '../../users/dto';
import { UserRole } from '../../database/schema';
import { CurrentUser } from './user.decorator';
import { IS_PUBLIC_KEY, Public } from './public.decorator';
import { Roles } from './roles.decorator';

const contextWith = (user: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

/**
 * Nest records a custom param decorator's factory in ROUTE_ARGS_METADATA on the
 * declaring class. Pulling it back out runs the real factory rather than a
 * reimplementation of it.
 */
const factoryFrom = (target: object, method: string) => {
  const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, target, method) as
    | Record<
        string,
        { factory: (data: unknown, ctx: ExecutionContext) => unknown }
      >
    | undefined;

  const entry = Object.values(metadata ?? {})[0];
  return entry.factory;
};

describe('@CurrentUser', () => {
  class TestController {
    handler(@CurrentUser() _user: UserResponseDto) {
      return _user;
    }
  }

  const factory = factoryFrom(TestController, 'handler');

  it('pulls the authenticated user off the request', () => {
    const user = { id: 'user-id', email: 'a@b.com' };

    expect(factory(undefined, contextWith(user))).toBe(user);
  });

  it('yields undefined on an unauthenticated request', () => {
    expect(factory(undefined, contextWith(undefined))).toBeUndefined();
  });
});

describe('metadata decorators', () => {
  it('@Public marks a handler as public', () => {
    class Target {
      handler() {}
    }
    Public()(Target.prototype, 'handler', {
      value: Target.prototype.handler,
    });

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, Target.prototype.handler)).toBe(
      true,
    );
  });

  it('@Roles records the allowed roles', () => {
    class Target {
      handler() {}
    }
    Roles(UserRole.ADMIN, UserRole.MODERATOR)(Target.prototype, 'handler', {
      value: Target.prototype.handler,
    });

    expect(Reflect.getMetadata('roles', Target.prototype.handler)).toEqual([
      UserRole.ADMIN,
      UserRole.MODERATOR,
    ]);
  });
});
