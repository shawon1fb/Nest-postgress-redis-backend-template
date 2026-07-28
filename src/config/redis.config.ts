import { Configuration, Value } from '@itgorillaz/configify';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { toInt } from './parsers';

@Configuration()
export class RedisConfig {
  @IsNotEmpty()
  @IsString()
  @Value('REDIS_HOST', { default: 'localhost' })
  host: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @Value('REDIS_PORT', { parse: toInt, default: 6379 })
  port: number;

  @IsOptional()
  @IsString()
  @Value('REDIS_PASSWORD', { default: '' })
  password: string;

  /** Cache entry lifetime in milliseconds. */
  @IsInt()
  @Min(1)
  @Value('CACHE_TTL', { parse: toInt, default: 3600000 })
  ttl: number;
}
