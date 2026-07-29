import { BadRequestException } from '@nestjs/common';
import { UsersMessage } from '../common/i18n';
import { UserRole } from '../database/schema';
import { UserResponseDto } from './dto';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  const user = { id: 'user-id', firstName: 'John' } as UserResponseDto;

  const service = {
    create: jest.fn().mockResolvedValue(user),
    findAll: jest.fn().mockResolvedValue({ data: [user], meta: {} }),
    findOne: jest.fn().mockResolvedValue(user),
    update: jest.fn().mockResolvedValue(user),
    changePassword: jest
      .fn()
      .mockResolvedValue({ message: UsersMessage.PASSWORD_CHANGED }),
    remove: jest.fn().mockResolvedValue({ message: UsersMessage.DELETED }),
    softDelete: jest.fn().mockResolvedValue(user),
    findByEmail: jest.fn().mockResolvedValue(user),
    findByUsername: jest.fn().mockResolvedValue(user),
  };
  const controller = new UsersController(service as unknown as UsersService);

  afterEach(() => jest.clearAllMocks());

  it('create delegates to the service', async () => {
    await expect(
      controller.create({ email: 'a@b.com' } as never),
    ).resolves.toBe(user);
  });

  it('findAll passes the query DTO straight through', async () => {
    const query = { page: 2, limit: 5 };

    await controller.findAll(query as never);

    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne looks the user up by id', async () => {
    await expect(controller.findOne('abc')).resolves.toBe(user);
    expect(service.findOne).toHaveBeenCalledWith('abc');
  });

  it('getProfile resolves the caller from the token', async () => {
    await controller.getProfile(user);

    expect(service.findOne).toHaveBeenCalledWith('user-id');
  });

  describe('updateProfile', () => {
    it('applies only the self-editable fields', async () => {
      await controller.updateProfile(user, {
        firstName: 'Jane',
        lastName: 'Doe',
        profilePicture: 'https://cdn/a.png',
        role: UserRole.ADMIN,
        isActive: false,
      } as never);

      expect(service.update).toHaveBeenCalledWith('user-id', {
        firstName: 'Jane',
        lastName: 'Doe',
        profilePicture: 'https://cdn/a.png',
      });
    });

    it('drops undefined fields instead of nulling them out', async () => {
      await controller.updateProfile(user, { firstName: 'Jane' } as never);

      expect(service.update).toHaveBeenCalledWith('user-id', {
        firstName: 'Jane',
      });
    });
  });

  it('update forwards an admin edit unchanged', async () => {
    const dto = { email: 'new@example.com' };

    await controller.update('target-id', dto as never);

    expect(service.update).toHaveBeenCalledWith('target-id', dto);
  });

  it('changePassword scopes the change to the caller', async () => {
    const dto = {
      currentPassword: 'a',
      newPassword: 'b',
      confirmPassword: 'b',
    };

    await controller.changePassword(user, dto as never);

    expect(service.changePassword).toHaveBeenCalledWith('user-id', dto);
  });

  it('deleteProfile soft deletes and reports the message', async () => {
    await expect(controller.deleteProfile(user)).resolves.toEqual({
      message: UsersMessage.ACCOUNT_DEACTIVATED,
    });
    expect(service.softDelete).toHaveBeenCalledWith('user-id');
  });

  it('remove hard deletes by id', async () => {
    await expect(controller.remove('target-id')).resolves.toEqual({
      message: UsersMessage.DELETED,
    });
  });

  it.each([
    ['activateUser', { isActive: true }],
    ['deactivateUser', { isActive: false }],
    ['verifyEmail', { isEmailVerified: true }],
  ])('%s patches the matching flag', async (method, patch) => {
    await (
      controller as unknown as Record<string, (id: string) => Promise<unknown>>
    )[method]('target-id');

    expect(service.update).toHaveBeenCalledWith('target-id', patch);
  });

  it('updateRole applies the validated role', async () => {
    await controller.updateRole('target-id', {
      role: UserRole.MODERATOR,
    } as never);

    expect(service.update).toHaveBeenCalledWith('target-id', {
      role: UserRole.MODERATOR,
    });
  });

  describe('search', () => {
    it('findByEmail requires the query parameter', async () => {
      await expect(controller.findByEmail('')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(service.findByEmail).not.toHaveBeenCalled();
    });

    it('findByEmail returns the match', async () => {
      await expect(controller.findByEmail('a@b.com')).resolves.toBe(user);
    });

    it('findByUsername requires the query parameter', async () => {
      await expect(controller.findByUsername('')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('findByUsername returns the match', async () => {
      await expect(controller.findByUsername('john')).resolves.toBe(user);
    });
  });
});
