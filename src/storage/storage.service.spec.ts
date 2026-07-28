// Asserting on jest mock properties trips unbound-method; the stubs are plain
// mocks with no `this` to lose.
/* eslint-disable @typescript-eslint/unbound-method */
import { Readable } from 'stream';
import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { StorageConfig, StorageDriverName } from '../config/storage.config';
import { DatabaseService } from '../database/database.service';
import { PutObjectInput, StorageDriver } from './interfaces';
import { StorageService } from './storage.service';

const driverStub = (): jest.Mocked<StorageDriver> => ({
  name: StorageDriverName.LOCAL,
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
});
