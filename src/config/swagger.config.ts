import { Configuration, Value } from '@itgorillaz/configify';
import { IsNotEmpty, IsOptional } from 'class-validator';

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

  @IsNotEmpty()
  @Value('SWAGGER_ENABLED', { default: true })
  enabled: boolean;

  @IsOptional()
  @Value('SWAGGER_SERVERS')
  servers?: string;
}
