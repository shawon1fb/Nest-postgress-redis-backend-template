import { Configuration, Value } from '@itgorillaz/configify';
import { IsIn, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import { toInt } from './parsers';

@Configuration()
export class AppConfig {
  @IsInt()
  @Min(1)
  @Max(65535)
  @Value('PORT', { parse: toInt, default: 8000 })
  port: number;

  @IsIn(['development', 'production', 'test'])
  @Value('NODE_ENV', { default: 'development' })
  nodeEnv: 'development' | 'production' | 'test';

  @IsNotEmpty()
  @IsString()
  @Value('API_PREFIX', { default: 'api/v1' })
  apiPrefix: string;

  @IsNotEmpty()
  @IsString()
  @Value('JWT_SECRET')
  jwtSecret: string;

  @IsNotEmpty()
  @IsString()
  @Value('JWT_REFRESH_SECRET')
  jwtRefreshSecret: string;

  @IsNotEmpty()
  @IsString()
  @Value('JWT_EXPIRES_IN', { default: '15m' })
  jwtExpiresIn: string;

  @IsNotEmpty()
  @IsString()
  @Value('JWT_REFRESH_EXPIRES_IN', { default: '7d' })
  jwtRefreshExpiresIn: string;

  /**
   * bcrypt cost factor. Must be a real number — bcrypt treats a string second
   * argument as a salt and throws "Invalid salt".
   */
  @IsInt()
  @Min(4)
  @Max(20)
  @Value('BCRYPT_ROUNDS', { parse: toInt, default: 12 })
  bcryptRounds: number;

  @IsInt()
  @Min(1)
  @Value('RATE_LIMIT_TTL', { parse: toInt, default: 60 })
  rateLimitTtl: number;

  @IsInt()
  @Min(1)
  @Value('RATE_LIMIT_LIMIT', { parse: toInt, default: 100 })
  rateLimitLimit: number;

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
}
