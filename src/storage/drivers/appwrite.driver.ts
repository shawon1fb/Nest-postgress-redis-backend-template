import { createHash } from 'crypto';
import { Readable } from 'stream';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Client, Storage, Tokens } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { StorageConfig, StorageDriverName } from '../../config/storage.config';
import {
  PutObjectInput,
  PutObjectResult,
  SignedUrlOptions,
  StorageDriver,
} from '../interfaces/storage-driver.interface';
import { StorageMessage } from '../../common/i18n';

/**
 * Appwrite Storage buckets.
 *
 * Appwrite addresses files by a flat `fileId` (max 36 chars, no slashes), while
 * the rest of the app uses path-like keys. The file id is therefore derived
 * deterministically from the key, so no extra mapping table is needed and the
 * same key always resolves to the same file.
 */
@Injectable()
export class AppwriteStorageDriver implements StorageDriver {
  readonly name = StorageDriverName.APPWRITE;

  /** URLs carry a short-lived resource token. */
  readonly urlsArePermanent = false;

  private readonly storage: Storage;
  private readonly tokens: Tokens;
  private readonly bucketId: string;

  constructor(private readonly config: StorageConfig) {
    const missing = (
      [
        ['STORAGE_APPWRITE_ENDPOINT', config.appwriteEndpoint],
        ['STORAGE_APPWRITE_PROJECT_ID', config.appwriteProjectId],
        ['STORAGE_APPWRITE_API_KEY', config.appwriteApiKey],
        ['STORAGE_APPWRITE_BUCKET_ID', config.appwriteBucketId],
      ] as const
    )
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length) {
      throw new InternalServerErrorException(
        `STORAGE_DRIVER=appwrite requires: ${missing.join(', ')}`,
      );
    }

    const client = new Client()
      .setEndpoint(config.appwriteEndpoint)
      .setProject(config.appwriteProjectId)
      .setKey(config.appwriteApiKey);

    this.storage = new Storage(client);
    this.tokens = new Tokens(client);
    this.bucketId = config.appwriteBucketId;
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const fileId = this.toFileId(input.key);

    // Appwrite has no overwrite; drop any previous file at this id first.
    await this.delete(input.key);

    try {
      const file = await this.storage.createFile({
        bucketId: this.bucketId,
        fileId,
        file: InputFile.fromBuffer(input.body, this.toFileName(input.key)),
      });

      return {
        key: input.key,
        size: file.sizeOriginal || input.body.length,
        providerId: file.$id,
      };
    } catch (error) {
      throw this.toHttpException(error, 'Failed to upload file to Appwrite');
    }
  }

  async get(key: string): Promise<Readable> {
    try {
      const buffer = await this.storage.getFileDownload({
        bucketId: this.bucketId,
        fileId: this.toFileId(key),
      });
      return Readable.from(Buffer.from(buffer));
    } catch (error) {
      throw this.toHttpException(error, 'Failed to read file from Appwrite');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.storage.deleteFile({
        bucketId: this.bucketId,
        fileId: this.toFileId(key),
      });
    } catch (error) {
      // Deleting an absent file is a no-op, matching the driver contract.
      if (this.statusOf(error) === 404) {
        return;
      }
      throw this.toHttpException(error, 'Failed to delete file from Appwrite');
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.storage.getFile({
        bucketId: this.bucketId,
        fileId: this.toFileId(key),
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Builds a view URL carrying a short-lived resource token, so private
   * buckets stay private.
   */
  async url(key: string, options?: SignedUrlOptions): Promise<string> {
    const fileId = this.toFileId(key);
    const expiresIn = options?.expiresIn ?? this.config.urlExpiresIn;

    try {
      const token = await this.tokens.createFileToken({
        bucketId: this.bucketId,
        fileId,
        expire: new Date(Date.now() + expiresIn * 1000).toISOString(),
      });

      const endpoint = this.config.appwriteEndpoint.replace(/\/+$/, '');
      const query = new URLSearchParams({
        project: this.config.appwriteProjectId,
        token: token.secret,
      });

      return `${endpoint}/storage/buckets/${this.bucketId}/files/${fileId}/view?${query.toString()}`;
    } catch (error) {
      throw this.toHttpException(
        error,
        'Failed to create an Appwrite file token',
      );
    }
  }

  /**
   * md5 of the key, hex encoded: 32 chars of `[a-f0-9]`, inside Appwrite's
   * 36-char id limit and allowed charset. Used only to derive a stable id,
   * never as a security primitive.
   */
  private toFileId(key: string): string {
    return createHash('md5').update(key).digest('hex');
  }

  private toFileName(key: string): string {
    return key.split('/').pop() || key;
  }

  private statusOf(error: unknown): number | undefined {
    return (error as { code?: number })?.code;
  }

  private toHttpException(error: unknown, fallbackMessage: string): Error {
    if (this.statusOf(error) === 404) {
      return new NotFoundException(StorageMessage.FILE_NOT_FOUND);
    }
    return new InternalServerErrorException(fallbackMessage);
  }
}
