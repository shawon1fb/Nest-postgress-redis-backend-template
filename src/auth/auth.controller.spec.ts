import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserResponseDto } from '../users/dto';

describe('AuthController', () => {
  const tokens = { accessToken: 'access', refreshToken: 'refresh' };
  const user = { id: 'user-id' } as UserResponseDto;

  const service = {
    register: jest.fn().mockResolvedValue({ ...tokens, user }),
    login: jest.fn().mockResolvedValue({ ...tokens, user }),
    refreshTokens: jest.fn().mockResolvedValue(tokens),
    logout: jest.fn().mockResolvedValue({ message: 'auth.logged_out' }),
    forgotPassword: jest
      .fn()
      .mockResolvedValue({ message: 'auth.password_reset_sent' }),
    resetPassword: jest
      .fn()
      .mockResolvedValue({ message: 'auth.password_reset_success' }),
  };
  const controller = new AuthController(service as unknown as AuthService);

  afterEach(() => jest.clearAllMocks());

  it('register delegates to the service', async () => {
    const dto = { email: 'a@b.com' };

    await expect(controller.register(dto as never)).resolves.toMatchObject(
      tokens,
    );
    expect(service.register).toHaveBeenCalledWith(dto);
  });

  it('login delegates to the service', async () => {
    const dto = { email: 'a@b.com', password: 'x' };

    await expect(controller.login(dto as never)).resolves.toMatchObject(tokens);
    expect(service.login).toHaveBeenCalledWith(dto);
  });

  it('refresh passes only the token through', async () => {
    await expect(
      controller.refresh({ refreshToken: 'refresh' } as never),
    ).resolves.toEqual(tokens);
    expect(service.refreshTokens).toHaveBeenCalledWith('refresh');
  });

  it('logout uses the authenticated user id', async () => {
    await expect(controller.logout(user)).resolves.toEqual({
      message: 'auth.logged_out',
    });
    expect(service.logout).toHaveBeenCalledWith('user-id');
  });

  it('forgotPassword forwards the email only', async () => {
    await expect(
      controller.forgotPassword({ email: 'a@b.com' } as never),
    ).resolves.toEqual({ message: 'auth.password_reset_sent' });
    expect(service.forgotPassword).toHaveBeenCalledWith('a@b.com');
  });

  it('resetPassword forwards the token and the new password', async () => {
    await expect(
      controller.resetPassword({
        token: 'tok',
        newPassword: 'New1!',
      } as never),
    ).resolves.toEqual({ message: 'auth.password_reset_success' });
    expect(service.resetPassword).toHaveBeenCalledWith('tok', 'New1!');
  });
});
