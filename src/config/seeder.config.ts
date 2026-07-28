import { Configuration, Value } from '@itgorillaz/configify';
import {
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsString,
  IsNotEmpty,
} from 'class-validator';
import { toBoolean, toInt } from './parsers';

@Configuration()
export class SeederConfig {
  @IsInt()
  @Min(1)
  @Max(10000)
  @Value('SEEDER_USER_COUNT', { parse: toInt, default: 50 })
  userCount: number;

  @IsBoolean()
  @Value('SEEDER_CLEAR_EXISTING', { parse: toBoolean, default: true })
  clearExisting: boolean;

  @IsBoolean()
  @Value('SEEDER_VERBOSE_LOGGING', { parse: toBoolean, default: true })
  verboseLogging: boolean;

  @IsNotEmpty()
  @IsString()
  @Value('SEEDER_ENVIRONMENT', { default: 'development' })
  environment: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @Value('SEEDER_BATCH_SIZE', { parse: toInt, default: 10 })
  batchSize: number;

  // Safety check to prevent running in production
  isProductionEnvironment(): boolean {
    return (
      this.environment?.toLowerCase()?.includes('prod') ||
      this.environment?.toLowerCase()?.includes('production') ||
      false
    );
  }

  // Get user roles distribution (percentages)
  getUserRoleDistribution(): {
    admin: number;
    moderator: number;
    user: number;
  } {
    return {
      admin: 0.05, // 5% admins
      moderator: 0.15, // 15% moderators
      user: 0.8, // 80% regular users
    };
  }
}
