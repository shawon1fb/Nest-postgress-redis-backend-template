import { UnauthorizedException } from '@nestjs/common';
import { AppConfig } from '../../config/app.config';
import { AuthService, JwtPayload } from '../auth.service';
import { UserResponseDto } from '../../users/dto';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const config = Object.assign(new AppConfig(), {
    jwtSecret: 'test-secret',
  });

  const payload: JwtPayload = {
    sub: '11111111-1111-1111-1111-111111111111',
    email: 'user@example.com',
    username: 'user',
    role: 'user',
  };

  const strategyWith = (validateUser: jest.Mock) => ({
    strategy: new JwtStrategy(config, {
      validateUser,
    } as unknown as AuthService),
    validateUser,
  });

  it('returns the user the auth service resolved from the payload', async () => {
    const user = { id: payload.sub } as UserResponseDto;
    const { strategy, validateUser } = strategyWith(
      jest.fn().mockResolvedValue(user),
    );

    await expect(strategy.validate(payload)).resolves.toBe(user);
    expect(validateUser).toHaveBeenCalledWith(payload);
  });

  it('rejects a token whose user no longer resolves', async () => {
    const { strategy } = strategyWith(jest.fn().mockResolvedValue(null));

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
