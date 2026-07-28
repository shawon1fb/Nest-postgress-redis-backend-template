import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { StorageMessage } from '../i18n';
import { ParsedMultipart, UploadedFileData } from './multipart.types';

/**
 * A multipart body is a one-shot stream: it can only be read once. The parsed
 * result is cached on the request so several decorators on the same handler
 * (`@UploadedFile()` plus `@MultipartBody()`) each get the whole picture
 * instead of racing for the stream.
 */
const PARSED = Symbol('parsedMultipart');

type CachedRequest = FastifyRequest & { [PARSED]?: Promise<ParsedMultipart> };

/** Thrown by @fastify/multipart when `limits.fileSize` is exceeded. */
const FILE_TOO_LARGE_CODE = 'FST_REQ_FILE_TOO_LARGE';

export async function parseMultipart(
  request: FastifyRequest,
): Promise<ParsedMultipart> {
  if (!request.isMultipart()) {
    throw new BadRequestException(StorageMessage.MULTIPART_REQUIRED);
  }

  const cached = request as CachedRequest;
  // Cache the promise, not the result: two decorators resolve in the same tick
  // and must not both start consuming the stream.
  cached[PARSED] ??= consume(request);

  return cached[PARSED];
}

async function consume(request: FastifyRequest): Promise<ParsedMultipart> {
  const files: UploadedFileData[] = [];
  const fields: Record<string, string> = {};

  try {
    for await (const part of request.parts()) {
      if (part.type === 'file') {
        // Each file stream must be drained before the iterator advances.
        const buffer = await part.toBuffer();
        files.push({
          field: part.fieldname,
          originalName: part.filename,
          mimeType: part.mimetype,
          buffer,
          size: buffer.length,
        });
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }
  } catch (error) {
    if ((error as { code?: string })?.code === FILE_TOO_LARGE_CODE) {
      throw new PayloadTooLargeException(StorageMessage.FILE_TOO_LARGE_LIMIT);
    }
    throw error;
  }

  return { files, fields };
}
