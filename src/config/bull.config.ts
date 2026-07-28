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

/**
 * Redis connection BullMQ uses for queues. Kept separate from `RedisConfig` so
 * queues can point at a different instance than the cache; leave the BULLMQ_*
 * vars unset to fall back to a local Redis.
 */
@Configuration()
export class BullMQRedisConfig {
  @IsNotEmpty()
  @IsString()
  @Value('BULLMQ_REDIS_HOST', { default: 'localhost' })
  host: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @Value('BULLMQ_REDIS_PORT', { parse: toInt, default: 6379 })
  port: number;

  @IsOptional()
  @IsString()
  @Value('BULLMQ_REDIS_PASSWORD', { default: '' })
  password: string;
}
