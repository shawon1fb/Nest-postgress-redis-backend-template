import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '../../database/schema';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

const contextWith = (user?: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  }) as unknown as ExecutionContext;

const reflectorReturning = <T>(value: T): Reflector =>
  ({ getAllAndOverride: () => value }) as unknown as Reflector;

describe('JwtAuthGuard', () => {
  it('lets a @Public() route through without authenticating', () => {
    const guard = new JwtAuthGuard(reflectorReturning(true));

    expect(guard.canActivate(contextWith())).toBe(true);
  });

  it('delegates to passport when the route is not public', () => {
    const guard = new JwtAuthGuard(reflectorReturning(false));
    const parent = jest
      .spyOn(
        AuthGuard('jwt').prototype as { canActivate: () => boolean },
        'canActivate',
      )
      .mockReturnValue(true);

    expect(guard.canActivate(contextWith())).toBe(true);
    expect(parent).toHaveBeenCalled();

    parent.mockRestore();
  });

  describe('handleRequest', () => {
    const guard = new JwtAuthGuard(reflectorReturning(false));

    it('returns the user when authentication succeeded', () => {
      const user = { id: '1' };

      expect(guard.handleRequest(null, user, null, contextWith())).toBe(user);
    });

    it('rethrows the original error when passport reported one', () => {
      const failure = new Error('token expired');

      expect(() =>
        guard.handleRequest(failure, null, null, contextWith()),
      ).toThrow(failure);
    });

    it('rejects a missing user', () => {
      expect(() =>
        guard.handleRequest(null, null, null, contextWith()),
      ).toThrow(UnauthorizedException);
    });
  });
});

describe('RolesGuard', () => {
  it('allows a route that declares no roles', () => {
    const guard = new RolesGuard(reflectorReturning(undefined));

    expect(guard.canActivate(contextWith({ role: UserRole.USER }))).toBe(true);
  });

  it('allows a user holding one of the required roles', () => {
    const guard = new RolesGuard(
      reflectorReturning([UserRole.ADMIN, UserRole.MODERATOR]),
    );

    expect(guard.canActivate(contextWith({ role: UserRole.MODERATOR }))).toBe(
      true,
    );
  });

  it('rejects a user whose role is not listed', () => {
    const guard = new RolesGuard(reflectorReturning([UserRole.ADMIN]));

    expect(() =>
      guard.canActivate(contextWith({ role: UserRole.USER })),
    ).toThrow(ForbiddenException);
  });

  it('rejects an unauthenticated request on a role-guarded route', () => {
    const guard = new RolesGuard(reflectorReturning([UserRole.ADMIN]));

    expect(() => guard.canActivate(contextWith(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
