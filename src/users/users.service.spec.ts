import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersMessage } from '../common/i18n';
import { createDrizzleMock, DrizzleMock } from '../test-utils/drizzle-mock';
import { UserRole } from './dto/create-user.dto';
import { UsersService } from './users.service';

const userRow = (overrides: Record<string, unknown> = {}) => ({
  id: '11111111-1111-1111-1111-111111111111',
  email: 'john@example.com',
  username: 'john',
  firstName: 'John',
  lastName: 'Doe',
  password: 'hashed',
  role: UserRole.USER,
  isActive: true,
  isEmailVerified: false,
  isTwoFactorEnabled: false,
  loginAttempts: 0,
  lockUntil: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

describe('UsersService', () => {
  let mock: DrizzleMock;
  let service: UsersService;

  beforeEach(() => {
    mock = createDrizzleMock();
    service = new UsersService(mock.databaseService);
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password' as never);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('create', () => {
    const dto = {
      email: 'john@example.com',
      username: 'john',
      firstName: 'John',
      lastName: 'Doe',
      password: 'Secret123!',
    };

    it('hashes the password and returns the created user without it', async () => {
      mock.queue.select.push([]); // uniqueness check finds nothing
      mock.queue.insert.push([userRow()]);

      const result = await service.create(dto as never);

      expect(bcrypt.hash).toHaveBeenCalledWith('Secret123!', 12);
      expect(mock.calls.valuePayloads[0]).toMatchObject({
        password: 'hashed-password',
      });
      expect(result.email).toBe('john@example.com');
      expect((result as { password?: string }).password).toBeUndefined();
    });

    it('rejects a duplicate email', async () => {
      mock.queue.select.push([userRow()]);

      await expect(service.create(dto as never)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects a duplicate username', async () => {
      mock.queue.select.push([
        userRow({ email: 'other@example.com', username: 'john' }),
      ]);

      await expect(service.create(dto as never)).rejects.toThrow(
        ConflictException,
      );
    });

    it('maps a unique-violation from the database to a conflict', async () => {
      mock.queue.select.push([]);
      mock.calls.insert.mockImplementationOnce(() => {
        throw Object.assign(new Error('duplicate'), { code: '23505' });
      });

      await expect(service.create(dto as never)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rethrows an unrelated database failure untouched', async () => {
      mock.queue.select.push([]);
      mock.calls.insert.mockImplementationOnce(() => {
        throw new Error('connection lost');
      });

      await expect(service.create(dto as never)).rejects.toThrow(
        'connection lost',
      );
    });
  });

  describe('findAll', () => {
    it('returns a paginated envelope payload', async () => {
      mock.queue.select.push([{ total: 2 }]);
      mock.queue.select.push([userRow(), userRow({ id: 'second' })]);

      const result = await service.findAll({ page: 1, limit: 10 } as never);

      expect(result.data).toHaveLength(2);
      expect(result.meta).toMatchObject({
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('applies filters and sorting without error', async () => {
      mock.queue.select.push([{ total: 0 }]);
      mock.queue.select.push([]);

      const result = await service.findAll({
        page: 2,
        limit: 5,
        search: 'jo',
        role: UserRole.ADMIN,
        isActive: true,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      } as never);

      expect(result.data).toEqual([]);
      expect(result.meta.page).toBe(2);
    });

    it('rejects a reversed date range', async () => {
      await expect(
        service.findAll({
          dateFrom: new Date('2026-05-01'),
          dateTo: new Date('2026-01-01'),
        } as never),
      ).rejects.toThrow('Date from cannot be greater than date to');
    });
  });

  describe('lookups', () => {
    it('findOne returns the mapped user', async () => {
      mock.queue.select.push([userRow()]);

      await expect(service.findOne('id')).resolves.toMatchObject({
        username: 'john',
      });
    });

    it('findOne throws when the user is absent', async () => {
      mock.queue.select.push([]);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('findByEmail lowercases the lookup and returns null when absent', async () => {
      mock.queue.select.push([]);

      await expect(service.findByEmail('JOHN@EXAMPLE.COM')).resolves.toBeNull();
    });

    it('findByEmail returns the mapped user when present', async () => {
      mock.queue.select.push([userRow()]);

      await expect(
        service.findByEmail('john@example.com'),
      ).resolves.toMatchObject({ email: 'john@example.com' });
    });

    it('findByUsername returns null when absent', async () => {
      mock.queue.select.push([]);

      await expect(service.findByUsername('nobody')).resolves.toBeNull();
    });

    it('findByUsername returns the mapped user when present', async () => {
      mock.queue.select.push([userRow()]);

      await expect(service.findByUsername('john')).resolves.toMatchObject({
        username: 'john',
      });
    });
  });

  describe('update', () => {
    it('updates an existing user and stamps updatedAt', async () => {
      mock.queue.select.push([userRow()]); // findUserById
      mock.queue.update.push([userRow({ firstName: 'Jane' })]);

      const result = await service.update('id', { firstName: 'Jane' } as never);

      expect(result.firstName).toBe('Jane');
      expect(mock.calls.setPayloads[0]).toHaveProperty('updatedAt');
    });

    it('checks for conflicts when the email changes', async () => {
      mock.queue.select.push([userRow()]); // findUserById
      mock.queue.select.push([userRow({ id: 'other' })]); // conflict found

      await expect(
        service.update('id', { email: 'john@example.com' } as never),
      ).rejects.toThrow(ConflictException);
    });

    it('throws when the target user does not exist', async () => {
      mock.queue.select.push([]);

      await expect(
        service.update('missing', { firstName: 'X' } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('maps a unique violation during update to a conflict', async () => {
      mock.queue.select.push([userRow()]);
      mock.calls.update.mockImplementationOnce(() => {
        throw Object.assign(new Error('duplicate'), { code: '23505' });
      });

      await expect(
        service.update('id', { firstName: 'X' } as never),
      ).rejects.toThrow(ConflictException);
    });

    it('softDelete deactivates rather than removing', async () => {
      mock.queue.select.push([userRow()]);
      mock.queue.update.push([userRow({ isActive: false })]);

      await expect(service.softDelete('id')).resolves.toMatchObject({
        isActive: false,
      });
      expect(mock.calls.setPayloads[0]).toMatchObject({ isActive: false });
    });
  });

  describe('changePassword', () => {
    const dto = {
      currentPassword: 'OldPass1!',
      newPassword: 'NewPass1!',
      confirmPassword: 'NewPass1!',
    };

    it('replaces the hash when the current password matches', async () => {
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mock.queue.select.push([userRow()]);

      await expect(service.changePassword('id', dto as never)).resolves.toEqual(
        {
          message: UsersMessage.PASSWORD_CHANGED,
        },
      );
      expect(mock.calls.setPayloads[0]).toMatchObject({
        password: 'hashed-password',
      });
    });

    it('rejects when the confirmation does not match', async () => {
      await expect(
        service.changePassword('id', {
          ...dto,
          confirmPassword: 'Different1!',
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an incorrect current password', async () => {
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
      mock.queue.select.push([userRow()]);

      await expect(service.changePassword('id', dto as never)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('remove', () => {
    it('deletes an existing user', async () => {
      mock.queue.select.push([userRow()]);
      mock.queue.delete.push([{ id: 'deleted' }]);

      await expect(service.remove('id')).resolves.toEqual({
        message: UsersMessage.DELETED,
      });
    });

    it('throws when the delete affected no row', async () => {
      mock.queue.select.push([userRow()]);
      mock.queue.delete.push([]);

      await expect(service.remove('id')).rejects.toThrow(NotFoundException);
    });

    it('throws when the user never existed', async () => {
      mock.queue.select.push([]);

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('login attempt tracking', () => {
    it('resets counters and stamps the login on success', async () => {
      await service.updateLoginAttempts('john@example.com', true);

      expect(mock.calls.setPayloads[0]).toMatchObject({
        loginAttempts: 0,
        lockUntil: null,
      });
    });

    it('increments the counter on failure without locking early', async () => {
      mock.queue.select.push([userRow({ loginAttempts: 1 })]);

      await service.updateLoginAttempts('john@example.com');

      expect(mock.calls.setPayloads[0]).toMatchObject({
        loginAttempts: 2,
        lockUntil: null,
      });
    });

    it('locks the account once the attempt ceiling is reached', async () => {
      mock.queue.select.push([userRow({ loginAttempts: 4 })]);

      await service.updateLoginAttempts('john@example.com');

      const payload = mock.calls.setPayloads[0] as { lockUntil: Date | null };
      expect(payload.lockUntil).toBeInstanceOf(Date);
    });

    it('does nothing for an unknown email', async () => {
      mock.queue.select.push([]);

      await service.updateLoginAttempts('nobody@example.com');

      expect(mock.calls.update).not.toHaveBeenCalled();
    });
  });

  describe('isAccountLocked', () => {
    it('is false for an unknown user', async () => {
      mock.queue.select.push([]);

      await expect(service.isAccountLocked('nobody@example.com')).resolves.toBe(
        false,
      );
    });

    it('is false when no lock is set', async () => {
      mock.queue.select.push([userRow({ lockUntil: null })]);

      await expect(service.isAccountLocked('john@example.com')).resolves.toBe(
        false,
      );
    });

    it('is true while the lock is in the future', async () => {
      mock.queue.select.push([
        userRow({ lockUntil: new Date(Date.now() + 60_000) }),
      ]);

      await expect(service.isAccountLocked('john@example.com')).resolves.toBe(
        true,
      );
    });

    it('clears an expired lock and reports unlocked', async () => {
      mock.queue.select.push([
        userRow({ lockUntil: new Date(Date.now() - 60_000) }),
      ]);

      await expect(service.isAccountLocked('john@example.com')).resolves.toBe(
        false,
      );
      // The expired lock is reset through updateLoginAttempts(email, true).
      expect(mock.calls.update).toHaveBeenCalled();
    });
  });
});
