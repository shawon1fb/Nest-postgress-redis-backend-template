import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import {
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { ApiResponseDto, ErrorResponseDto } from '../dto/api-response.dto';
import { PaginationMetaDto } from '../dto/paginated-response.dto';

/**
 * Anything a handler can put under `data`: a DTO class or a primitive.
 */
export type EnvelopePayload = Type<unknown> | 'string' | 'number' | 'boolean';

interface EnvelopeOptions {
  status: number;
  description: string;
  /** Payload is an array of `model`. */
  isArray?: boolean;
  /** Handler may resolve to null (e.g. "find or null" lookups). */
  nullable?: boolean;
}

const isModelClass = (payload: EnvelopePayload): payload is Type<unknown> =>
  typeof payload === 'function';

const payloadSchema = (
  payload: EnvelopePayload,
): SchemaObject | ReferenceObject =>
  isModelClass(payload) ? { $ref: getSchemaPath(payload) } : { type: payload };

const dataSchema = (
  payload: EnvelopePayload,
  { isArray, nullable }: EnvelopeOptions,
): SchemaObject | ReferenceObject => {
  const base = payloadSchema(payload);
  const schema: SchemaObject | ReferenceObject = isArray
    ? { type: 'array', items: base }
    : base;

  // A $ref cannot carry sibling keywords, so wrap it when nullability applies.
  if (!nullable) {
    return schema;
  }
  return isArray
    ? { ...(schema as SchemaObject), nullable: true }
    : { allOf: [schema], nullable: true };
};

const envelope = (
  extraProps: Record<string, SchemaObject | ReferenceObject>,
  required: string[],
  status: number,
): SchemaObject => ({
  allOf: [
    { $ref: getSchemaPath(ApiResponseDto) },
    {
      type: 'object',
      required,
      properties: {
        statusCode: { type: 'number', example: status },
        ...extraProps,
      },
    },
  ],
});

/**
 * Documents a successful response as it actually leaves the app, i.e. wrapped
 * by TransformInterceptor: `{ success, statusCode, message, data }`.
 *
 * ```ts
 * @ApiEnvelopeResponse(UserResponseDto, { status: 200, description: 'Found' })
 * @ApiEnvelopeResponse(UserResponseDto, { status: 200, description: '...', isArray: true })
 * @ApiEnvelopeResponse('string', { status: 200, description: '...' })
 * ```
 */
export const ApiEnvelopeResponse = (
  payload: EnvelopePayload,
  options: EnvelopeOptions,
) =>
  applyDecorators(
    ApiExtraModels(ApiResponseDto, ...(isModelClass(payload) ? [payload] : [])),
    ApiResponse({
      status: options.status,
      description: options.description,
      schema: envelope(
        { data: dataSchema(payload, options) },
        ['data'],
        options.status,
      ),
    }),
  );

/**
 * Paginated variant. TransformInterceptor lifts `data`/`meta` out of
 * `PaginatedResponseDto` onto the envelope, so `meta` is a sibling of `data`.
 *
 * Works for any module — pass the item DTO, not a per-module paginated wrapper.
 */
export const ApiEnvelopePaginatedResponse = <TModel extends Type<unknown>>(
  model: TModel,
  { status, description }: Pick<EnvelopeOptions, 'status' | 'description'>,
) =>
  applyDecorators(
    ApiExtraModels(ApiResponseDto, PaginationMetaDto, model),
    ApiResponse({
      status,
      description,
      schema: envelope(
        {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: { $ref: getSchemaPath(PaginationMetaDto) },
        },
        ['data', 'meta'],
        status,
      ),
    }),
  );

/**
 * Message-only responses. TransformInterceptor hoists `message` onto the
 * envelope and sets `data` to null.
 */
export const ApiEnvelopeMessageResponse = ({
  status,
  description,
  message,
}: Pick<EnvelopeOptions, 'status' | 'description'> & { message: string }) =>
  applyDecorators(
    ApiExtraModels(ApiResponseDto),
    ApiResponse({
      status,
      description,
      schema: envelope(
        {
          message: { type: 'string', example: message },
          data: { type: 'null', example: null, nullable: true },
        },
        ['data'],
        status,
      ),
    }),
  );

/**
 * Error responses as emitted by GlobalExceptionFilter.
 */
export const ApiErrorResponse = ({
  status,
  description,
  message,
}: Pick<EnvelopeOptions, 'status' | 'description'> & { message?: string }) =>
  applyDecorators(
    ApiExtraModels(ErrorResponseDto),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ErrorResponseDto) },
          {
            type: 'object',
            properties: {
              statusCode: { type: 'number', example: status },
              ...(message && { message: { example: message } }),
            },
          },
        ],
      },
    }),
  );
