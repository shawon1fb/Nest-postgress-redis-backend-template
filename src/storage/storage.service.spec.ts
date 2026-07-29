// Asserting on jest mock properties trips unbound-method; the stubs are plain
// mocks with no `this` to lose.
/* eslint-disable @typescript-eslint/unbound-method */
import { Readable } from 'stream';
import {
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { StorageMessage } from '../common/i18n';
import { StorageConfig, StorageDriverName } from '../config/storage.config';
import { DatabaseService } from '../database/database.service';
import { PutObjectInput, StorageDriver } from './interfaces';
import { StorageService } from './storage.service';

const driverStub = (): jest.Mocked<StorageDriver> => ({
  name: StorageDriverName.LOCAL,
  urlsArePermanent: false,
  put: jest
    .fn()
    .mockImplementation(({ key, body }: PutObjectInput) =>
      Promise.resolve({ key, size: body.length, providerId: null }),
    ),
  get: jest.fn().mockResolvedValue(Readable.from('x')),
  delete: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(true),
  url: jest.fn().mockResolvedValue('https://example.com/f'),
});

/** Minimal Drizzle stand-in covering the insert().values().returning() chain. */
const databaseStub = (inserted: Record<string, unknown>) =>
  ({
    getDatabase: () => ({
      insert: () => ({
        values: (row: Record<string, unknown>) => ({
          returning: () => Promise.resolve([{ ...inserted, ...row }]),
        }),
      }),
    }),
  }) as unknown as DatabaseService;

const configWith = (overrides: Partial<StorageConfig>): StorageConfig =>
  Object.assign(new StorageConfig(), {
    driver: StorageDriverName.LOCAL,
    maxFileSize: 1024,
    allowedMimeTypes: '',
    urlExpiresIn: 900,
    ...overrides,
  });

describe('StorageService', () => {
  const baseRow = {
    id: '11111111-1111-1111-1111-111111111111',
    createdAt: new Date('2026-07-28T00:00:00.000Z'),
    updatedAt: new Date('2026-07-28T00:00:00.000Z'),
    checksum: null,
    uploadedBy: null,
    metadata: null,
    providerId: null,
  };

  const serviceWith = (config: StorageConfig, driver = driverStub()) => ({
    driver,
    service: new StorageService(databaseStub(baseRow), config, driver),
  });

  const upload = (
    service: StorageService,
    buffer: Buffer,
    mime = 'image/png',
  ) => service.upload({ buffer, originalName: 'a.png', mimeType: mime });

  it('stores the file through the configured driver and returns its metadata', async () => {
    const { service, driver } = serviceWith(configWith({}));

    const result = await upload(service, Buffer.from('abc'));

    expect(driver.put).toHaveBeenCalledTimes(1);
    expect(driver.put.mock.calls[0][0].key).toMatch(
      /^uploads\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/,
    );
    expect(result.size).toBe(3);
    expect(result.driver).toBe(StorageDriverName.LOCAL);
    // Client-supplied name is recorded but never decides the storage key.
    expect(result.originalName).toBe('a.png');
    expect(result.key).not.toContain('a.png');
  });

  it('rejects an empty upload', async () => {
    const { service, driver } = serviceWith(configWith({}));

    await expect(upload(service, Buffer.alloc(0))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(driver.put).not.toHaveBeenCalled();
  });

  it('rejects a file larger than STORAGE_MAX_FILE_SIZE', async () => {
    const { service, driver } = serviceWith(configWith({ maxFileSize: 4 }));

    await expect(upload(service, Buffer.alloc(5))).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
    expect(driver.put).not.toHaveBeenCalled();
  });

  it('rejects a MIME type outside the allow-list', async () => {
    const { service, driver } = serviceWith(
      configWith({ allowedMimeTypes: 'image/png, image/jpeg' }),
    );

    await expect(
      upload(service, Buffer.from('abc'), 'application/pdf'),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    expect(driver.put).not.toHaveBeenCalled();
  });

  it('accepts a MIME type present in the allow-list', async () => {
    const { service } = serviceWith(
      configWith({ allowedMimeTypes: 'image/png, image/jpeg' }),
    );

    await expect(
      upload(service, Buffer.from('abc'), 'image/png'),
    ).resolves.toMatchObject({ mimeType: 'image/png' });
  });

  it('exposes the active driver name', () => {
    const { service } = serviceWith(configWith({}));

    expect(service.driverName).toBe(StorageDriverName.LOCAL);
  });

  describe('reads and deletes', () => {
    const record = {
      id: 'file-id',
      key: 'uploads/2026/07/a.png',
      driver: StorageDriverName.LOCAL,
      originalName: 'a.png',
      mimeType: 'image/png',
      size: 12,
      checksum: null,
      uploadedBy: null,
      metadata: null,
      createdAt: new Date('2026-07-28'),
      updatedAt: new Date('2026-07-28'),
    };

    /** Drizzle stand-in for the select/delete chains these methods run. */
    const dbWith = (selectResults: unknown[][]) => {
      const queue = [...selectResults];
      const chain = (rows: unknown[]): unknown => {
        const proxy: unknown = new Proxy(
          {},
          {
            get(_t, property) {
              if (property === 'then') {
                return (resolve: (value: unknown[]) => unknown) =>
                  Promise.resolve(rows).then(resolve);
              }
              return () => proxy;
            },
          },
        );
        return proxy;
      };
      return {
        getDatabase: () => ({
          select: () => chain(queue.shift() ?? []),
          delete: () => chain([]),
        }),
      } as unknown as DatabaseService;
    };

    const serviceReading = (
      selectResults: unknown[][],
      driver = driverStub(),
      config = configWith({}),
    ) => ({
      driver,
      service: new StorageService(dbWith(selectResults), config, driver),
    });

    it('findOne maps the stored row', async () => {
      const { service } = serviceReading([[record]]);

      await expect(service.findOne('file-id')).resolves.toMatchObject({
        id: 'file-id',
        originalName: 'a.png',
      });
    });

    it('findOne throws when the row is missing', async () => {
      const { service } = serviceReading([[]]);

      await expect(service.findOne('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('findAll returns a paginated payload', async () => {
      const { service } = serviceReading([[{ total: 1 }], [record]]);

      const result = await service.findAll({ page: 1, limit: 10 } as never);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toMatchObject({ total: 1, page: 1 });
    });

    it('findAll accepts mime and driver filters', async () => {
      const { service } = serviceReading([[{ total: 0 }], []]);

      const result = await service.findAll({
        mimeType: 'image/png',
        driver: StorageDriverName.S3,
      } as never);

      expect(result.data).toEqual([]);
    });

    it('download streams the object alongside its metadata', async () => {
      const { service, driver } = serviceReading([[record]]);

      const result = await service.download('file-id');

      expect(driver.get).toHaveBeenCalledWith(record.key);
      expect(result.record.mimeType).toBe('image/png');
    });

    it('getUrl reports the ttl for an expiring driver', async () => {
      const { service, driver } = serviceReading([[record]]);

      await expect(service.getUrl('file-id')).resolves.toEqual({
        url: 'https://example.com/f',
        expiresIn: 900,
      });
      expect(driver.url).toHaveBeenCalledWith(record.key, { expiresIn: 900 });
    });

    it('getUrl honours a caller-supplied ttl', async () => {
      const { service } = serviceReading([[record]]);

      await expect(service.getUrl('file-id', 60)).resolves.toMatchObject({
        expiresIn: 60,
      });
    });

    it('getUrl reports 0 for a permanent-URL driver', async () => {
      const permanent = { ...driverStub(), urlsArePermanent: true };
      const { service } = serviceReading([[record]], permanent);

      await expect(service.getUrl('file-id')).resolves.toMatchObject({
        expiresIn: 0,
      });
    });

    it('remove deletes from the backend and the table', async () => {
      const { service, driver } = serviceReading([[record]]);

      await expect(service.remove('file-id')).resolves.toEqual({
        message: StorageMessage.DELETED,
      });
      expect(driver.delete).toHaveBeenCalledWith(record.key);
    });

    it('remove throws for an unknown id without touching the backend', async () => {
      const { service, driver } = serviceReading([[]]);

      await expect(service.remove('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(driver.delete).not.toHaveBeenCalled();
    });
  });
});
