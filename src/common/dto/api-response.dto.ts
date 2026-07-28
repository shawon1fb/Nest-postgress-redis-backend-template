import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Base envelope produced by TransformInterceptor for every successful response.
 * The concrete `data` shape is attached per-endpoint by the ApiEnvelope*
 * decorators in `src/common/decorators/api-response.decorator.ts`.
 */
export class ApiResponseDto {
  @ApiProperty({
    description: 'Always true for successful responses',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'HTTP status code of the response',
    example: 200,
  })
  statusCode: number;

  @ApiProperty({
    description:
      'Human readable message. "Success" for data responses, or the operation message for message-only responses.',
    example: 'Success',
  })
  message: string;
}

/**
 * Message-only handler result, shared by every module. TransformInterceptor
 * hoists `message` onto the envelope and sets `data` to null, so this class is
 * never serialized as-is — document such endpoints with
 * `ApiEnvelopeMessageResponse`.
 */
export class MessageResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Operation completed successfully',
  })
  message: string;
}

/**
 * Envelope shape emitted by GlobalExceptionFilter.
 */
export class ErrorResponseDto {
  @ApiProperty({
    description: 'Always false for error responses',
    example: false,
  })
  success: boolean;

  @ApiProperty({
    description: 'HTTP status code of the error',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description:
      'Error message, or an array of messages when validation fails. Sanitized in production.',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Invalid credentials',
  })
  message: string | string[];

  @ApiPropertyOptional({
    description:
      'Field level validation errors. Omitted in production and when not applicable.',
    example: { email: 'Please provide a valid email address' },
  })
  errors?: Record<string, any> | string[];

  @ApiPropertyOptional({
    description: 'Request path. Only present outside production.',
    example: '/auth/login',
  })
  path?: string;

  @ApiPropertyOptional({
    description: 'Request method. Only present outside production.',
    example: 'POST',
  })
  method?: string;
}
