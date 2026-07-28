import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiResponseDto, ErrorResponseDto } from '../dto/api-response.dto';
import { PaginationMetaDto } from '../dto/paginated-response.dto';

interface EnvelopeOptions {
  status: number;
  description: string;
}

/**
 * Documents a successful response as it actually leaves the app, i.e. wrapped
 * by TransformInterceptor: `{ success, statusCode, message, data }`.
 */
export const ApiEnvelopeResponse = <TModel extends Type<unknown>>(
  model: TModel,
  { status, description }: EnvelopeOptions,
) =>
  applyDecorators(
    ApiExtraModels(ApiResponseDto, model),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          {
            type: 'object',
            required: ['data'],
            properties: {
              statusCode: { type: 'number', example: status },
              data: { $ref: getSchemaPath(model) },
            },
          },
        ],
      },
    }),
  );

/**
 * Same as ApiEnvelopeResponse but for handlers returning an array payload.
 */
export const ApiEnvelopeArrayResponse = <TModel extends Type<unknown>>(
  model: TModel,
  { status, description }: EnvelopeOptions,
) =>
  applyDecorators(
    ApiExtraModels(ApiResponseDto, model),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          {
            type: 'object',
            required: ['data'],
            properties: {
              statusCode: { type: 'number', example: status },
              data: { type: 'array', items: { $ref: getSchemaPath(model) } },
            },
          },
        ],
      },
    }),
  );

/**
 * Paginated variant: TransformInterceptor lifts `data`/`meta` to the envelope.
 */
export const ApiEnvelopePaginatedResponse = <TModel extends Type<unknown>>(
  model: TModel,
  { status, description }: EnvelopeOptions,
) =>
  applyDecorators(
    ApiExtraModels(ApiResponseDto, PaginationMetaDto, model),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          {
            type: 'object',
            required: ['data', 'meta'],
            properties: {
              statusCode: { type: 'number', example: status },
              data: { type: 'array', items: { $ref: getSchemaPath(model) } },
              meta: { $ref: getSchemaPath(PaginationMetaDto) },
            },
          },
        ],
      },
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
}: EnvelopeOptions & { message: string }) =>
  applyDecorators(
    ApiExtraModels(ApiResponseDto),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          {
            type: 'object',
            required: ['data'],
            properties: {
              statusCode: { type: 'number', example: status },
              message: { type: 'string', example: message },
              data: { type: 'null', example: null, nullable: true },
            },
          },
        ],
      },
    }),
  );

/**
 * Error responses as emitted by GlobalExceptionFilter.
 */
export const ApiErrorResponse = ({
  status,
  description,
  message,
}: EnvelopeOptions & { message?: string }) =>
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
