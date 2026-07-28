import { Readable } from 'stream';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageConfig, StorageDriverName } from '../../config/storage.config';
import {
  PutObjectInput,
  PutObjectResult,
  SignedUrlOptions,
  StorageDriver,
} from '../interfaces/storage-driver.interface';
import { StorageMessage } from '../../common/i18n';

/**
 * Works against any S3-compatible API: AWS S3, MinIO, Cloudflare R2,
 * DigitalOcean Spaces, Wasabi. Point `STORAGE_S3_ENDPOINT` at the provider and
 * set `STORAGE_S3_FORCE_PATH_STYLE=true` for self-hosted gateways.
 */
@Injectable()
export class S3StorageDriver implements StorageDriver {
  readonly name = StorageDriverName.S3;

  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: StorageConfig) {
    const missing = (
      [
        ['STORAGE_S3_BUCKET', config.s3Bucket],
        ['STORAGE_S3_ACCESS_KEY_ID', config.s3AccessKeyId],
        ['STORAGE_S3_SECRET_ACCESS_KEY', config.s3SecretAccessKey],
      ] as const
    )
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length) {
      throw new InternalServerErrorException(
        `STORAGE_DRIVER=s3 requires: ${missing.join(', ')}`,
      );
    }

    this.bucket = config.s3Bucket;
    this.client = new S3Client({
      region: config.s3Region,
      forcePathStyle: config.s3ForcePathStyle,
      ...(config.s3Endpoint && { endpoint: config.s3Endpoint }),
      credentials: {
        accessKeyId: config.s3AccessKeyId,
        secretAccessKey: config.s3SecretAccessKey,
      },
    });
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.mimeType,
        ContentLength: input.body.length,
        Metadata: input.metadata,
      }),
    );

    return { key: input.key, size: input.body.length, providerId: null };
  }

  async get(key: string): Promise<Readable> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );

      if (!result.Body) {
        throw new NotFoundException(StorageMessage.FILE_NOT_FOUND);
      }
      return result.Body as Readable;
    } catch (error) {
      throw this.toHttpException(error, 'Failed to read file from S3');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      // S3 delete is already idempotent; only surface real failures.
      throw this.toHttpException(error, 'Failed to delete file from S3');
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async url(key: string, options?: SignedUrlOptions): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: options?.expiresIn ?? this.config.urlExpiresIn },
    );
  }

  private toHttpException(error: unknown, fallbackMessage: string): Error {
    if (error instanceof NotFoundException) {
      return error;
    }

    const name = (error as { name?: string })?.name;
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } })
      ?.$metadata?.httpStatusCode;

    if (name === 'NoSuchKey' || name === 'NotFound' || statusCode === 404) {
      return new NotFoundException(StorageMessage.FILE_NOT_FOUND);
    }
    return new InternalServerErrorException(fallbackMessage);
  }
}
