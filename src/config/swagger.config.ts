import { Configuration, Value } from '@itgorillaz/configify';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { toBoolean } from './parsers';

@Configuration()
export class SwaggerConfig {
  @IsNotEmpty()
  @Value('SWAGGER_TITLE', { default: 'Backend template API' })
  title: string;

  @IsNotEmpty()
  @Value('SWAGGER_DESCRIPTION', {
    default:
      'A comprehensive NestJS-based backend application for sports administration',
  })
  description: string;

  @IsNotEmpty()
  @Value('SWAGGER_VERSION', { default: '1.0.0' })
  version: string;

  @IsOptional()
  @Value('SWAGGER_CONTACT_NAME', { default: 'Backend template Team' })
  contactName: string;

  @IsOptional()
  @Value('SWAGGER_CONTACT_EMAIL', { default: 'admin@sportsadmin.com' })
  contactEmail: string;

  @IsNotEmpty()
  @Value('SWAGGER_PATH', { default: '/api/docs' })
  path: string;

  // Must be parsed: without it `SWAGGER_ENABLED=false` is the truthy string
  // "false", which would publish the API docs in production.
  @IsBoolean()
  @Value('SWAGGER_ENABLED', { parse: toBoolean, default: true })
  enabled: boolean;

  @IsOptional()
  @IsString()
  @Value('SWAGGER_SERVERS', { default: '' })
  servers?: string;
}
