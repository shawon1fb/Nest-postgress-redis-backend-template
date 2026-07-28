import { Readable } from 'stream';
import { StorageDriverName } from '../../config/storage.config';

/**
 * Injection token for the driver selected by `STORAGE_DRIVER`.
 * Inject `StorageService` instead unless you need the raw backend.
 */
export const STORAGE_DRIVER = 'STORAGE_DRIVER';

export interface PutObjectInput {
  /** Canonical storage key, e.g. `uploads/2026/07/<uuid>.png`. */
  key: string;
  body: Buffer;
  mimeType: string;
  /** Free-form metadata; backends that cannot store it may drop it. */
  metadata?: Record<string, string>;
}

export interface PutObjectResult {
  key: string;
  size: number;
  /**
   * Backend's own identifier when it differs from `key` (Appwrite file id,
   * for instance). Null when the backend addresses objects by key.
   */
  providerId: string | null;
}

export interface SignedUrlOptions {
  /** Overrides `STORAGE_URL_EXPIRES_IN`. Ignored by backends serving public URLs. */
  expiresIn?: number;
}

/**
 * Contract every storage backend implements. Keep it backend-agnostic: no
 * S3/Appwrite types may appear in these signatures, so a new provider only
 * needs a driver class plus a `StorageDriverName` entry.
 *
 * Implementations must throw Nest `HttpException` subclasses so
 * `GlobalExceptionFilter` renders them, never bare `Error`.
 */
export interface StorageDriver {
  readonly name: StorageDriverName;

  /** Writes an object, overwriting any existing object at `key`. */
  put(input: PutObjectInput): Promise<PutObjectResult>;

  /** Streams an object back. Throws `NotFoundException` when absent. */
  get(key: string): Promise<Readable>;

  /** Removes an object. Missing objects are not an error (idempotent). */
  delete(key: string): Promise<void>;

  exists(key: string): Promise<boolean>;

  /**
   * URL a client can fetch the object from — signed and time-limited on
   * backends that support it, otherwise a plain public URL.
   */
  url(key: string, options?: SignedUrlOptions): Promise<string>;
}
