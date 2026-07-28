import { createHash, randomUUID } from 'crypto';
import { extname } from 'path';
import { Readable } from 'stream';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { files, FileRecord } from '../database/schema';
import { StorageConfig, StorageDriverName } from '../config/storage.config';
import { MessageResponseDto, PaginatedResponseDto } from '../common/dto';
import { PaginationUtil } from '../common/utils';
import { STORAGE_DRIVER, StorageDriver } from './interfaces';
import { FileResponseDto, FileUrlResponseDto, QueryFileDto } from './dto';
import { StorageMessage, translate } from '../common/i18n';

export interface UploadFileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  /** User the file belongs to, when uploaded through an authenticated route. */
  uploadedBy?: string;
  metadata?: Record<string, string>;
}

/**
 * Storage facade. Callers work with this and never touch a driver directly, so
 * switching `STORAGE_DRIVER` changes nothing for them.
 */
@Injectable()
export class StorageService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: StorageConfig,
    @Inject(STORAGE_DRIVER) private readonly driver: StorageDriver,
  ) {}

  /** Backend currently in use — handy for health endpoints and debugging. */
  get driverName(): string {
    return this.driver.name;
  }

  async upload(input: UploadFileInput): Promise<FileResponseDto> {
    this.assertAcceptable(input);

    const key = this.buildKey(input.originalName);
    const stored = await this.driver.put({
      key,
      body: input.buffer,
      mimeType: input.mimeType,
      metadata: input.metadata,
    });

    const db = this.databaseService.getDatabase();
    const [record] = await db
      .insert(files)
      .values({
        key: stored.key,
        driver: this.driver.name,
        providerId: stored.providerId,
        originalName: input.originalName,
        mimeType: input.mimeType,
        size: stored.size,
        checksum: createHash('sha256').update(input.buffer).digest('hex'),
        uploadedBy: input.uploadedBy,
        metadata: input.metadata,
      })
      .returning();

    return this.toResponseDto(record);
  }

  async findAll(
    queryDto: QueryFileDto,
  ): Promise<PaginatedResponseDto<FileResponseDto>> {
    const { page, limit, offset } =
      PaginationUtil.validateAndNormalizePagination({
        page: queryDto.page,
        limit: queryDto.limit,
      });

    const conditions = [
      queryDto.mimeType ? eq(files.mimeType, queryDto.mimeType) : undefined,
      queryDto.driver ? eq(files.driver, queryDto.driver) : undefined,
    ].filter((condition) => condition !== undefined);

    const where = conditions.length ? and(...conditions) : undefined;
    const db = this.databaseService.getDatabase();

    const [{ total }] = await db
      .select({ total: count() })
      .from(files)
      .where(where);

    const records = await db
      .select()
      .from(files)
      .where(where)
      .orderBy(desc(files.createdAt))
      .limit(limit)
      .offset(offset);

    return PaginatedResponseDto.create(
      records.map((record) => this.toResponseDto(record)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<FileResponseDto> {
    return this.toResponseDto(await this.findRecord(id));
  }

  /** Returns the stored bytes plus the metadata needed to set response headers. */
  async download(
    id: string,
  ): Promise<{ stream: Readable; record: FileResponseDto }> {
    const record = await this.findRecord(id);
    return {
      stream: await this.driver.get(record.key),
      record: this.toResponseDto(record),
    };
  }

  async getUrl(id: string, expiresIn?: number): Promise<FileUrlResponseDto> {
    const record = await this.findRecord(id);
    const ttl = expiresIn ?? this.config.urlExpiresIn;

    return {
      url: await this.driver.url(record.key, { expiresIn: ttl }),
      // The local driver serves plain public URLs that never expire.
      expiresIn: this.driver.name === StorageDriverName.LOCAL ? 0 : ttl,
    };
  }

  async remove(id: string): Promise<MessageResponseDto> {
    const record = await this.findRecord(id);

    await this.driver.delete(record.key);

    const db = this.databaseService.getDatabase();
    await db.delete(files).where(eq(files.id, id));

    return { message: StorageMessage.DELETED };
  }

  private assertAcceptable(input: UploadFileInput): void {
    if (!input.buffer.length) {
      throw new BadRequestException(StorageMessage.EMPTY_FILE);
    }

    if (input.buffer.length > this.config.maxFileSize) {
      throw new PayloadTooLargeException(
        translate(StorageMessage.FILE_TOO_LARGE, {
          maxSize: this.config.maxFileSize,
        }),
      );
    }

    const allowed = this.config.allowedMimeTypeList;
    if (allowed.length && !allowed.includes(input.mimeType)) {
      throw new UnsupportedMediaTypeException(
        translate(StorageMessage.MIME_NOT_ALLOWED, {
          mimeType: input.mimeType,
          allowed: allowed.join(', '),
        }),
      );
    }
  }

  /**
   * Date-partitioned key with a random basename — keeps directory listings
   * small and stops a client-supplied name from deciding where bytes land.
   */
  private buildKey(originalName: string): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const extension = extname(originalName).toLowerCase().slice(0, 16);

    return `uploads/${year}/${month}/${randomUUID()}${extension}`;
  }

  private async findRecord(id: string): Promise<FileRecord> {
    const db = this.databaseService.getDatabase();
    const [record] = await db.select().from(files).where(eq(files.id, id));

    if (!record) {
      throw new NotFoundException(StorageMessage.FILE_NOT_FOUND);
    }
    return record;
  }

  private toResponseDto(record: FileRecord): FileResponseDto {
    return {
      id: record.id,
      key: record.key,
      driver: record.driver as FileResponseDto['driver'],
      originalName: record.originalName,
      mimeType: record.mimeType,
      size: record.size,
      checksum: record.checksum,
      uploadedBy: record.uploadedBy,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
