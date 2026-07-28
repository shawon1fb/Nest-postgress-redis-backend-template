import { Configuration, Value } from '@itgorillaz/configify';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { toBoolean, toInt } from './parsers';

@Configuration()
export class DatabaseConfig {
  @IsNotEmpty()
  @IsString()
  @Value('DB_HOST', { default: 'localhost' })
  host: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @Value('DB_PORT', { parse: toInt, default: 5432 })
  port: number;

  @IsNotEmpty()
  @IsString()
  @Value('DB_NAME', { default: 'sports_admin' })
  database: string;

  @IsNotEmpty()
  @IsString()
  @Value('DB_USER', { default: 'sports_user' })
  username: string;

  @IsNotEmpty()
  @IsString()
  @Value('DB_PASSWORD', { default: 'sports_password_2024' })
  password: string;

  // Must be parsed: the string "false" is truthy, which forced sslmode=require
  // on every connection string.
  @IsBoolean()
  @Value('DB_SSL', { parse: toBoolean, default: false })
  ssl: boolean;

  getDatabaseUrl(): string {
    const sslParam = this.ssl ? '?sslmode=require' : '';
    return `postgresql://${this.username}:${this.password}@${this.host}:${this.port}/${this.database}${sslParam}`;
  }
}
