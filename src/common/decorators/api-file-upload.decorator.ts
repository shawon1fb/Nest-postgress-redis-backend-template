import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

interface ApiFileUploadOptions {
  /** Extra form fields sent alongside the file, for Swagger's try-it form. */
  fields?: Record<string, { type: string; format?: string }>;
  /** Mark the file part optional in the docs. */
  required?: boolean;
}

/**
 * Documents a `multipart/form-data` upload so Swagger renders a file picker.
 * Pairs with `@UploadedFile(field)` — keep the field name identical.
 *
 * ```ts
 * @ApiFileUpload('image')
 * @UploadedFile('image') image: UploadedFileData
 * ```
 */
export const ApiFileUpload = (
  field = 'file',
  { fields = {}, required = true }: ApiFileUploadOptions = {},
) =>
  applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        ...(required && { required: [field] }),
        properties: {
          [field]: { type: 'string', format: 'binary' },
          ...fields,
        },
      },
    }),
  );
