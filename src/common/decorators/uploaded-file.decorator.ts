import {
  BadRequestException,
  ExecutionContext,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  createParamDecorator,
} from '@nestjs/common';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FastifyRequest } from 'fastify';
import { CommonMessage, StorageMessage, translate } from '../i18n';
import { parseMultipart } from '../multipart/multipart.parser';
import { toBytes } from '../multipart/file-size.util';
import {
  UploadedFileData,
  UploadedFileOptions,
} from '../multipart/multipart.types';

const requestOf = (context: ExecutionContext) =>
  context.switchToHttp().getRequest<FastifyRequest>();

const normalize = (
  options?: string | UploadedFileOptions,
): UploadedFileOptions =>
  typeof options === 'string' ? { field: options } : (options ?? {});

/**
 * Enforces the per-route limits. The global `STORAGE_MAX_FILE_SIZE` and
 * `STORAGE_ALLOWED_MIME_TYPES` still apply in `StorageService`; these narrow
 * them for one endpoint.
 */
const assertAllowed = (
  file: UploadedFileData,
  { maxSize, mimeTypes }: UploadedFileOptions,
): void => {
  if (maxSize !== undefined) {
    const limit = toBytes(maxSize);
    if (file.size > limit) {
      throw new PayloadTooLargeException(
        translate(StorageMessage.FILE_TOO_LARGE, { maxSize: limit }),
      );
    }
  }

  if (mimeTypes?.length && !mimeTypes.includes(file.mimeType)) {
    throw new UnsupportedMediaTypeException(
      translate(StorageMessage.MIME_NOT_ALLOWED, {
        mimeType: file.mimeType,
        allowed: mimeTypes.join(', '),
      }),
    );
  }
};

/**
 * Pulls one file out of a `multipart/form-data` request.
 *
 * Replaces the `isMultipart()` / `request.file()` / null-check dance in every
 * upload handler, and yields a backend-agnostic shape that goes straight into
 * `StorageService.upload()`.
 *
 * ```ts
 * // simplest: required file in field "image"
 * upload(@UploadedFile('image') image: UploadedFileData) {}
 *
 * // with per-route constraints
 * upload(
 *   @UploadedFile({
 *     field: 'image',
 *     maxSize: '5mb',
 *     mimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
 *   })
 *   image: UploadedFileData,
 * ) {}
 *
 * // optional upload
 * update(@UploadedFile({ required: false }) file?: UploadedFileData) {}
 * ```
 *
 * Throws 400 when the request is not multipart or a required file is missing,
 * 413 when it exceeds `maxSize`, and 415 when its MIME type is not allowed.
 */
export const UploadedFileParam = createParamDecorator(
  async (
    options: string | UploadedFileOptions | undefined,
    context: ExecutionContext,
  ): Promise<UploadedFileData | undefined> => {
    const resolved = normalize(options);
    const { field, required = true } = resolved;
    const { files } = await parseMultipart(requestOf(context));

    const file = field
      ? files.find((candidate) => candidate.field === field)
      : files[0];

    if (!file) {
      if (required) {
        throw new BadRequestException(
          field
            ? translate(StorageMessage.FILE_FIELD_MISSING, { field })
            : StorageMessage.NO_FILE_UPLOADED,
        );
      }
      return undefined;
    }

    assertAllowed(file, resolved);
    return file;
  },
);

/** Every file part, for handlers that accept more than one upload. */
export const UploadedFilesParam = createParamDecorator(
  async (
    options: UploadedFileOptions | undefined,
    context: ExecutionContext,
  ): Promise<UploadedFileData[]> => {
    const resolved = normalize(options);
    const { field, required = false } = resolved;
    const { files } = await parseMultipart(requestOf(context));

    const matching = field
      ? files.filter((candidate) => candidate.field === field)
      : files;

    if (!matching.length && required) {
      throw new BadRequestException(StorageMessage.NO_FILE_UPLOADED);
    }

    matching.forEach((file) => assertAllowed(file, resolved));
    return matching;
  },
);

/**
 * The non-file parts of a multipart request, so a DTO can ride along with the
 * upload.
 *
 * ```ts
 * upload(
 *   @UploadedFile('image') image: UploadedFileData,
 *   @MultipartBody(CreatePhotoDto) dto: CreatePhotoDto,
 * ) {}
 * ```
 *
 * Validation runs inside the decorator rather than through the global
 * `CustomValidationPipe`, because Nest's ValidationPipe ignores custom
 * parameter decorators unless `validateCustomDecorators` is enabled — and
 * enabling it globally would whitelist-strip `@CurrentUser()` objects, which
 * carry no class-validator decorators.
 *
 * Omit the class to receive the raw string fields.
 */
export const MultipartBody = createParamDecorator(
  async (
    dtoClass: ClassConstructor<object> | undefined,
    context: ExecutionContext,
  ): Promise<unknown> => {
    const { fields } = await parseMultipart(requestOf(context));

    if (!dtoClass) {
      return fields;
    }

    // Multipart values are always strings; implicit conversion lets a DTO
    // declare `number` or `boolean` without annotating every field.
    const instance = plainToInstance(dtoClass, fields, {
      enableImplicitConversion: true,
    });

    const errors = await validate(instance, { whitelist: true });

    if (errors.length) {
      throw new BadRequestException({
        statusCode: 400,
        message: translate(CommonMessage.VALIDATION_FAILED),
        errors: errors.flatMap((error) =>
          Object.values(error.constraints ?? {}),
        ),
      });
    }
    return instance;
  },
);

// Primary names used in handlers:
//   @UploadedFile('image') image: UploadedFileData
export { UploadedFileParam as UploadedFile };
export { UploadedFilesParam as UploadedFiles };
