import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AppConfig } from '../config/app.config';
import { AuthMessage } from '../common/i18n';
import { UsersService } from '../users/users.service';
import { UserResponseDto } from '../users/dto';
import { createDrizzleMock, DrizzleMock } from '../test-utils/drizzle-mock';
import { AuthService, JwtPayload } from './auth.service';

const appConfig = Object.assign(new AppConfig(), {
  jwtSecret: 'access-secret',
  jwtRefreshSecret: 'refresh-secret',
  jwtExpiresIn: '15m',
  jwtRefreshExpiresIn: '7d',
  bcryptRounds: 12,
});

const user = (overrides: Record<string, unknown> = {}) =>
  ({
    id: '11111111-1111-1111-1111-111111111111',
    email: 'john@example.com',
    username: 'john',
    role: 'user',
    isActive: true,
    ...overrides,
  }) as unknown as UserResponseDto;

describe('AuthService', () => {
  let drizzle: DrizzleMock;
  let usersService: Record<string, jest.Mock>;
  let jwtService: Record<string, jest.Mock>;
  let service: AuthService;

  beforeEach(() => {
    drizzle = createDrizzleMock();
    usersService = {
      create: jest.fn(),
      findOne: jest.fn(),
      findByEmail: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn().mockResolvedValue(user()),
      changePassword: jest.fn(),
      isAccountLocked: jest.fn().mockResolvedValue(false),
      updateLoginAttempts: jest.fn().mockResolvedValue(undefined),
    };
    // findUserForAuthentication reaches through the users service for the
    // password column, which UserResponseDto deliberately hides.
    (usersService as Record<string, unknown>).databaseService =
      drizzle.databaseService;

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verify: jest.fn(),
    };

    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      appConfig,
    );

    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed' as never);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('register', () => {
    it('creates the user and issues both tokens', async () => {
      usersService.create.mockResolvedValue(user());

      const result = await service.register({ email: 'x' } as never);

      expect(result.user).toEqual(user());
      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
    });

    it('signs the access token with the access secret and payload claims', async () => {
      usersService.create.mockResolvedValue(user());

      await service.register({ email: 'x' } as never);

      const [payload, options] = jwtService.signAsync.mock.calls[0];
      expect(payload).toMatchObject({
        sub: user().id,
        email: 'john@example.com',
        username: 'john',
        role: 'user',
      });
      expect(options).toMatchObject({ secret: 'access-secret' });
    });
  });

  describe('login', () => {
    const credentials = { email: 'john@example.com', password: 'Secret123!' };

    const withStoredUser = (row: Record<string, unknown> | undefined) => {
      drizzle.queue.select.push(row ? [row] : []);
    };

    it('returns tokens and the profile on valid credentials', async () => {
      withStoredUser({ ...user(), password: 'hash' });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      usersService.findOne.mockResolvedValue(user());

      const result = await service.login(credentials);

      expect(result.user).toEqual(user());
      expect(result.accessToken).toBe('signed-token');
      expect(usersService.updateLoginAttempts).toHaveBeenCalledWith(
        credentials.email,
        true,
      );
    });

    it('refuses a locked account before checking the password', async () => {
      usersService.isAccountLocked.mockResolvedValue(true);

      await expect(service.login(credentials)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(drizzle.calls.select).not.toHaveBeenCalled();
    });

    it('records a failed attempt for an unknown email', async () => {
      withStoredUser(undefined);

      await expect(service.login(credentials)).rejects.toThrow(
        AuthMessage.INVALID_CREDENTIALS,
      );
      expect(usersService.updateLoginAttempts).toHaveBeenCalledWith(
        credentials.email,
        false,
      );
    });

    it('records a failed attempt for a wrong password', async () => {
      withStoredUser({ ...user(), password: 'hash' });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(service.login(credentials)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersService.updateLoginAttempts).toHaveBeenCalledWith(
        credentials.email,
        false,
      );
    });

    it('refuses a deactivated account even with the right password', async () => {
      withStoredUser({ ...user({ isActive: false }), password: 'hash' });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await expect(service.login(credentials)).rejects.toThrow(
        AuthMessage.ACCOUNT_DEACTIVATED,
      );
    });
  });

  describe('validateUser', () => {
    const payload: JwtPayload = {
      sub: user().id,
      email: 'john@example.com',
      username: 'john',
      role: 'user',
    };

    it('returns an active user', async () => {
      usersService.findOne.mockResolvedValue(user());

      await expect(service.validateUser(payload)).resolves.toEqual(user());
    });

    it('returns null for a deactivated user', async () => {
      usersService.findOne.mockResolvedValue(user({ isActive: false }));

      await expect(service.validateUser(payload)).resolves.toBeNull();
    });

    it('returns null when the user lookup throws', async () => {
      usersService.findOne.mockRejectedValue(new Error('not found'));

      await expect(service.validateUser(payload)).resolves.toBeNull();
    });
  });

  describe('refreshTokens', () => {
    it('issues a new pair for a valid refresh token', async () => {
      jwtService.verify.mockReturnValue({ sub: user().id });
      usersService.findOne.mockResolvedValue(user());

      await expect(service.refreshTokens('valid')).resolves.toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
      expect(jwtService.verify).toHaveBeenCalledWith('valid', {
        secret: 'refresh-secret',
      });
    });

    it('rejects a token that fails verification', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('bad signature');
      });

      await expect(service.refreshTokens('bad')).rejects.toThrow(
        AuthMessage.INVALID_REFRESH_TOKEN,
      );
    });

    it('rejects a token belonging to a deactivated user', async () => {
      jwtService.verify.mockReturnValue({ sub: user().id });
      usersService.findOne.mockResolvedValue(user({ isActive: false }));

      await expect(service.refreshTokens('valid')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('reports success', async () => {
      await expect(service.logout(user().id)).resolves.toEqual({
        message: AuthMessage.LOGGED_OUT,
      });
    });
  });

  describe('changePassword', () => {
    it('delegates to the users service with a matching confirmation', async () => {
      usersService.changePassword.mockResolvedValue({ message: 'ok' });

      await service.changePassword('id', 'Old1!', 'New1!');

      expect(usersService.changePassword).toHaveBeenCalledWith('id', {
        currentPassword: 'Old1!',
        newPassword: 'New1!',
        confirmPassword: 'New1!',
      });
    });
  });

  describe('forgotPassword', () => {
    it('stores a reset token for a known email', async () => {
      usersService.findByEmail.mockResolvedValue(user());

      await expect(service.forgotPassword('john@example.com')).resolves.toEqual(
        {
          message: AuthMessage.PASSWORD_RESET_SENT,
        },
      );

      const [, patch] = usersService.update.mock.calls[0];
      expect(patch).toMatchObject({
        passwordResetToken: expect.any(String) as string,
        passwordResetExpires: expect.any(Date) as Date,
      });
    });

    it('gives the same answer for an unknown email and stores nothing', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.forgotPassword('nobody@example.com'),
      ).resolves.toEqual({ message: AuthMessage.PASSWORD_RESET_SENT });
      expect(usersService.update).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const withCandidates = (rows: Record<string, unknown>[]) => {
      usersService.findAll.mockResolvedValue({ data: rows } as never);
    };

    it('sets a new password for a valid, unexpired token', async () => {
      withCandidates([
        {
          ...user(),
          passwordResetToken: 'token-123',
          passwordResetExpires: new Date(Date.now() + 60_000),
        },
      ]);

      await expect(
        service.resetPassword('token-123', 'NewPass1!'),
      ).resolves.toEqual({ message: AuthMessage.PASSWORD_RESET_SUCCESS });

      const [, patch] = usersService.update.mock.calls[0];
      expect(patch).toMatchObject({
        password: 'hashed',
        passwordResetToken: null,
        passwordResetExpires: null,
      });
    });

    it('rejects an unknown token', async () => {
      withCandidates([]);

      await expect(service.resetPassword('nope', 'NewPass1!')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an expired token', async () => {
      withCandidates([
        {
          ...user(),
          passwordResetToken: 'token-123',
          passwordResetExpires: new Date(Date.now() - 60_000),
        },
      ]);

      await expect(
        service.resetPassword('token-123', 'NewPass1!'),
      ).rejects.toThrow(AuthMessage.INVALID_RESET_TOKEN);
    });
  });
});
