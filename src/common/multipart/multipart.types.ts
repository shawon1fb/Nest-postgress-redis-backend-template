/**
 * A file part, already read into memory and detached from the request stream.
 * Shaped to drop straight into `StorageService.upload()`.
 */
export interface UploadedFileData {
  /** Form field the file arrived under, e.g. `image`. */
  field: string;
  /** Client-supplied name. Never trust it for storage paths. */
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  size: number;
}

/** Result of parsing a `multipart/form-data` body once. */
export interface ParsedMultipart {
  files: UploadedFileData[];
  /** Non-file parts, ready to be validated as a DTO. */
  fields: Record<string, string>;
}

export interface UploadedFileOptions {
  /** Restrict to one form field. Omit to accept the first file of any name. */
  field?: string;
  /**
   * Throw when no matching file is present. Defaults to true — set false for
   * optional uploads such as an avatar on a profile update.
   */
  required?: boolean;
  /**
   * Largest accepted file, as bytes or a readable size: `'5mb'`, `'512kb'`.
   * Applies on top of the global `STORAGE_MAX_FILE_SIZE` ceiling, which
   * @fastify/multipart still enforces while streaming.
   */
  maxSize?: number | string;
  /**
   * Accepted MIME types, e.g. `['image/png', 'image/jpeg', 'application/pdf']`.
   * Omit to accept anything the global storage allow-list permits.
   */
  mimeTypes?: string[];
}
