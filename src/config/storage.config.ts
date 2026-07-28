import { Configuration, Value } from '@itgorillaz/configify';
import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * Storage backends the app can be pointed at. Adding a new one means adding a
 * driver in `src/storage/drivers/` and registering it in `STORAGE_DRIVERS`.
 */
export enum StorageDriverName {
  LOCAL = 'local',
  S3 = 's3',
  APPWRITE = 'appwrite',
}

// Env values arrive as strings; coerce so consumers get real numbers/booleans.
const toNumber = (value: unknown): number => Number(value);
const toBoolean = (value: unknown): boolean =>
  value === true || value === 'true';

/**
 * Only the block matching STORAGE_DRIVER needs to be filled in; the driver
 * validates its own required values at startup.
 */
@Configuration()
export class StorageConfig {
  @IsNotEmpty()
  @IsEnum(StorageDriverName, {
    message: `STORAGE_DRIVER must be one of: ${Object.values(StorageDriverName).join(', ')}`,
  })
  @Value('STORAGE_DRIVER', { default: StorageDriverName.LOCAL })
  driver: StorageDriverName;

  /** Max accepted upload size in bytes. Enforced before the driver is called. */
  @IsNotEmpty()
  @Value('STORAGE_MAX_FILE_SIZE', {
    default: 10 * 1024 * 1024,
    parse: toNumber,
  })
  maxFileSize: number;

  /**
   * Comma-separated MIME allow-list. Empty means "accept anything".
   * e.g. `image/png,image/jpeg,application/pdf`
   */
  @IsOptional()
  @Value('STORAGE_ALLOWED_MIME_TYPES', { default: '' })
  allowedMimeTypes: string;

  /** Seconds a generated signed URL stays valid (s3 / appwrite). */
  @IsNotEmpty()
  @Value('STORAGE_URL_EXPIRES_IN', { default: 900, parse: toNumber })
  urlExpiresIn: number;

  // --- local driver ---------------------------------------------------------

  /** Directory files are written to, relative paths resolve from cwd. */
  @IsOptional()
  @Value('STORAGE_LOCAL_ROOT', { default: './storage/uploads' })
  localRoot: string;

  /** Public base URL that maps to `localRoot`, used to build file URLs. */
  @IsOptional()
  @Value('STORAGE_LOCAL_BASE_URL', { default: '' })
  localBaseUrl: string;

  // --- s3 driver (AWS S3, MinIO, R2, Spaces, Wasabi) ------------------------

  @IsOptional()
  @Value('STORAGE_S3_BUCKET', { default: '' })
  s3Bucket: string;

  @IsOptional()
  @Value('STORAGE_S3_REGION', { default: 'us-east-1' })
  s3Region: string;

  @IsOptional()
  @Value('STORAGE_S3_ACCESS_KEY_ID', { default: '' })
  s3AccessKeyId: string;

  @IsOptional()
  @Value('STORAGE_S3_SECRET_ACCESS_KEY', { default: '' })
  s3SecretAccessKey: string;

  /** Custom endpoint for S3-compatible providers. Empty means real AWS S3. */
  @IsOptional()
  @Value('STORAGE_S3_ENDPOINT', { default: '' })
  s3Endpoint: string;

  /** Required by MinIO and most self-hosted S3 gateways. */
  @IsOptional()
  @Value('STORAGE_S3_FORCE_PATH_STYLE', { default: false, parse: toBoolean })
  s3ForcePathStyle: boolean;

  // --- appwrite driver ------------------------------------------------------

  @IsOptional()
  @Value('STORAGE_APPWRITE_ENDPOINT', { default: '' })
  appwriteEndpoint: string;

  @IsOptional()
  @Value('STORAGE_APPWRITE_PROJECT_ID', { default: '' })
  appwriteProjectId: string;

  @IsOptional()
  @Value('STORAGE_APPWRITE_API_KEY', { default: '' })
  appwriteApiKey: string;

  @IsOptional()
  @Value('STORAGE_APPWRITE_BUCKET_ID', { default: '' })
  appwriteBucketId: string;

  /** Parsed allow-list. Empty array means every MIME type is accepted. */
  get allowedMimeTypeList(): string[] {
    return this.allowedMimeTypes
      .split(',')
      .map((type) => type.trim())
      .filter(Boolean);
  }
}
