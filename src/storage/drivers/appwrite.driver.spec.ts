import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { StorageConfig, StorageDriverName } from '../../config/storage.config';

const storageApi = {
  createFile: jest.fn(),
  getFileDownload: jest.fn(),
  deleteFile: jest.fn(),
  getFile: jest.fn(),
};
const tokensApi = { createFileToken: jest.fn() };

jest.mock('node-appwrite', () => {
  class Client {
    setEndpoint() {
      return this;
    }
    setProject() {
      return this;
    }
    setKey() {
      return this;
    }
  }
  return {
    Client,
    Storage: jest.fn(() => storageApi),
    Tokens: jest.fn(() => tokensApi),
  };
});

jest.mock('node-appwrite/file', () => ({
  InputFile: { fromBuffer: jest.fn(() => 'input-file') },
}));

// Imported after the mocks so the driver picks them up.
import { AppwriteStorageDriver } from './appwrite.driver';

const configWith = (overrides: Partial<StorageConfig> = {}): StorageConfig =>
  Object.assign(new StorageConfig(), {
    driver: StorageDriverName.APPWRITE,
    appwriteEndpoint: 'https://appwrite.example.com/v1',
    appwriteProjectId: 'project-1',
    appwriteApiKey: 'key-1',
    appwriteBucketId: 'bucket-1',
    urlExpiresIn: 900,
    ...overrides,
  });

const notFound = Object.assign(new Error('missing'), { code: 404 });

describe('AppwriteStorageDriver', () => {
  const key = 'uploads/2026/07/a.png';
  let driver: AppwriteStorageDriver;

  beforeEach(() => {
    jest.clearAllMocks();
    storageApi.deleteFile.mockResolvedValue({});
    driver = new AppwriteStorageDriver(configWith());
  });

  it('refuses to construct without the required settings', () => {
    expect(
      () => new AppwriteStorageDriver(configWith({ appwriteApiKey: '' })),
    ).toThrow(InternalServerErrorException);
    expect(
      () => new AppwriteStorageDriver(configWith({ appwriteBucketId: '' })),
    ).toThrow(/STORAGE_APPWRITE_BUCKET_ID/);
  });

  it('advertises expiring URLs', () => {
    expect(driver.urlsArePermanent).toBe(false);
    expect(driver.name).toBe(StorageDriverName.APPWRITE);
  });

  describe('put', () => {
    it('derives a stable file id and reports the stored size', async () => {
      storageApi.createFile.mockResolvedValue({
        $id: 'file-1',
        sizeOriginal: 42,
      });

      const result = await driver.put({
        key,
        body: Buffer.alloc(10),
        mimeType: 'image/png',
      });

      expect(result).toEqual({ key, size: 42, providerId: 'file-1' });
      const fileId = storageApi.createFile.mock.calls[0][0].fileId as string;
      expect(fileId).toMatch(/^[a-f0-9]{32}$/);
    });

    it('is deterministic: the same key yields the same id', async () => {
      storageApi.createFile.mockResolvedValue({ $id: 'x', sizeOriginal: 1 });

      await driver.put({ key, body: Buffer.alloc(1), mimeType: 'image/png' });
      await driver.put({ key, body: Buffer.alloc(1), mimeType: 'image/png' });

      const [first, second] = storageApi.createFile.mock.calls.map(
        (call) => (call[0] as { fileId: string }).fileId,
      );
      expect(first).toBe(second);
    });

    it('falls back to the buffer length when the API omits the size', async () => {
      storageApi.createFile.mockResolvedValue({ $id: 'x', sizeOriginal: 0 });

      const result = await driver.put({
        key,
        body: Buffer.alloc(7),
        mimeType: 'image/png',
      });

      expect(result.size).toBe(7);
    });

    it('surfaces an upload failure as a server error', async () => {
      storageApi.createFile.mockRejectedValue(new Error('boom'));

      await expect(
        driver.put({ key, body: Buffer.alloc(1), mimeType: 'image/png' }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('get', () => {
    it('streams the downloaded bytes', async () => {
      storageApi.getFileDownload.mockResolvedValue(
        Buffer.from('payload').buffer,
      );

      const stream = await driver.get(key);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
      }

      expect(Buffer.concat(chunks).length).toBeGreaterThan(0);
    });

    it('maps a 404 to NotFound', async () => {
      storageApi.getFileDownload.mockRejectedValue(notFound);

      await expect(driver.get(key)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it('removes the file', async () => {
      await expect(driver.delete(key)).resolves.toBeUndefined();
      expect(storageApi.deleteFile).toHaveBeenCalled();
    });

    it('treats a missing file as already deleted', async () => {
      storageApi.deleteFile.mockRejectedValue(notFound);

      await expect(driver.delete(key)).resolves.toBeUndefined();
    });

    it('surfaces other failures', async () => {
      storageApi.deleteFile.mockRejectedValue(new Error('boom'));

      await expect(driver.delete(key)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('exists', () => {
    it('is true when the file resolves', async () => {
      storageApi.getFile.mockResolvedValue({ $id: 'x' });

      await expect(driver.exists(key)).resolves.toBe(true);
    });

    it('is false when the lookup fails', async () => {
      storageApi.getFile.mockRejectedValue(notFound);

      await expect(driver.exists(key)).resolves.toBe(false);
    });
  });

  describe('url', () => {
    it('embeds a short-lived resource token', async () => {
      tokensApi.createFileToken.mockResolvedValue({ secret: 'tok-123' });

      const url = await driver.url(key);

      expect(url).toContain('/storage/buckets/bucket-1/files/');
      expect(url).toContain('project=project-1');
      expect(url).toContain('token=tok-123');
    });

    it('honours a caller-supplied expiry', async () => {
      tokensApi.createFileToken.mockResolvedValue({ secret: 'tok' });

      await driver.url(key, { expiresIn: 60 });

      const { expire } = tokensApi.createFileToken.mock.calls[0][0] as {
        expire: string;
      };
      expect(new Date(expire).getTime()).toBeGreaterThan(Date.now());
    });

    it('reports a token failure as a server error', async () => {
      tokensApi.createFileToken.mockRejectedValue(new Error('denied'));

      await expect(driver.url(key)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});
