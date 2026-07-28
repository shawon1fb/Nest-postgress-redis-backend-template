import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { NotFoundException } from '@nestjs/common';
import { StorageConfig, StorageDriverName } from '../../config/storage.config';
import { LocalStorageDriver } from './local.driver';

const configFor = (root: string): StorageConfig =>
  Object.assign(new StorageConfig(), {
    driver: StorageDriverName.LOCAL,
    localRoot: root,
    localBaseUrl: 'https://cdn.example.com/files',
  });

describe('LocalStorageDriver', () => {
  let root: string;
  let driver: LocalStorageDriver;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'storage-test-'));
    driver = new LocalStorageDriver(configFor(root));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const put = (key: string, contents = 'hello') =>
    driver.put({ key, body: Buffer.from(contents), mimeType: 'text/plain' });

  it('writes a file under the configured root, creating directories', async () => {
    const result = await put('uploads/2026/07/a.txt');

    expect(result).toEqual({
      key: 'uploads/2026/07/a.txt',
      size: 5,
      providerId: null,
    });
    await expect(
      readFile(join(root, 'uploads/2026/07/a.txt'), 'utf8'),
    ).resolves.toBe('hello');
  });

  it('reads back what it wrote', async () => {
    await put('a.txt', 'round trip');
    const stream = await driver.get('a.txt');

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    expect(Buffer.concat(chunks).toString()).toBe('round trip');
  });

  it('reports existence and deletes idempotently', async () => {
    await put('a.txt');
    await expect(driver.exists('a.txt')).resolves.toBe(true);

    await driver.delete('a.txt');
    await expect(driver.exists('a.txt')).resolves.toBe(false);

    // Deleting again must not throw — the contract says delete is idempotent.
    await expect(driver.delete('a.txt')).resolves.toBeUndefined();
  });

  it('throws NotFound for a missing key', async () => {
    await expect(driver.get('nope.txt')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuses keys that escape the storage root', async () => {
    await expect(put('../../etc/passwd')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(driver.get('../../etc/passwd')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('builds a public URL from the configured base', async () => {
    await expect(driver.url('uploads/a.txt')).resolves.toBe(
      'https://cdn.example.com/files/uploads/a.txt',
    );
  });
});
