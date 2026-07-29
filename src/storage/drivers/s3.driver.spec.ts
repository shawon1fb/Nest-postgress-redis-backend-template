import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Readable } from 'stream';
import {
  StorageConfig,
  StorageDriverName,
  StorageVisibility,
} from '../../config/storage.config';
import { S3StorageDriver } from './s3.driver';

const configWith = (overrides: Partial<StorageConfig>): StorageConfig =>
  Object.assign(new StorageConfig(), {
    driver: StorageDriverName.S3,
    s3Bucket: 'uploads',
    s3Region: 'us-east-1',
    s3AccessKeyId: 'key',
    s3SecretAccessKey: 'secret',
    s3Endpoint: 'http://localhost:9000',
    s3PublicEndpoint: '',
    s3ForcePathStyle: true,
    s3Visibility: StorageVisibility.PRIVATE,
    urlExpiresIn: 900,
    ...overrides,
  });

describe('S3StorageDriver URL strategy', () => {
  const key = 'uploads/2026/07/avatar.png';

  it('signs URLs when the bucket is private', async () => {
    const driver = new S3StorageDriver(configWith({}));

    expect(driver.urlsArePermanent).toBe(false);
    await expect(driver.url(key)).resolves.toMatch(/X-Amz-Signature=/);
  });

  it('returns a permanent unsigned URL when the bucket is public', async () => {
    const driver = new S3StorageDriver(
      configWith({ s3Visibility: StorageVisibility.PUBLIC }),
    );

    expect(driver.urlsArePermanent).toBe(true);
    await expect(driver.url(key)).resolves.toBe(
      'http://localhost:9000/uploads/uploads/2026/07/avatar.png',
    );
  });

  it('prefers the public endpoint when clients cannot reach the internal one', async () => {
    const driver = new S3StorageDriver(
      configWith({
        s3Visibility: StorageVisibility.PUBLIC,
        s3Endpoint: 'http://minio:9000',
        s3PublicEndpoint: 'https://cdn.example.com/',
      }),
    );

    await expect(driver.url(key)).resolves.toBe(
      'https://cdn.example.com/uploads/uploads/2026/07/avatar.png',
    );
  });

  it('uses virtual-hosted addressing when path style is off', async () => {
    const driver = new S3StorageDriver(
      configWith({
        s3Visibility: StorageVisibility.PUBLIC,
        s3ForcePathStyle: false,
        s3Endpoint: 'https://s3.eu-west-1.amazonaws.com',
      }),
    );

    await expect(driver.url(key)).resolves.toBe(
      'https://uploads.s3.eu-west-1.amazonaws.com/uploads/2026/07/avatar.png',
    );
  });

  it('escapes characters that are unsafe in a URL path', async () => {
    const driver = new S3StorageDriver(
      configWith({ s3Visibility: StorageVisibility.PUBLIC }),
    );

    await expect(driver.url('uploads/my file & co.png')).resolves.toBe(
      'http://localhost:9000/uploads/uploads/my%20file%20%26%20co.png',
    );
  });
});

describe('S3StorageDriver operations', () => {
  const send = jest.fn();
  const key = 'uploads/2026/07/a.png';

  const driverWith = () => {
    const driver = new S3StorageDriver(configWith({}));
    // Swap the real SDK client for a stub so nothing touches the network.
    (driver as unknown as { client: { send: jest.Mock } }).client = { send };
    return driver;
  };

  afterEach(() => jest.clearAllMocks());

  it('refuses to construct without bucket or credentials', () => {
    expect(
      () =>
        new S3StorageDriver(
          Object.assign(new StorageConfig(), {
            s3Bucket: '',
            s3AccessKeyId: '',
            s3SecretAccessKey: '',
          }),
        ),
    ).toThrow(/STORAGE_S3_BUCKET/);
  });

  it('put stores the object and reports its size', async () => {
    send.mockResolvedValue({});

    await expect(
      driverWith().put({ key, body: Buffer.alloc(9), mimeType: 'image/png' }),
    ).resolves.toEqual({ key, size: 9, providerId: null });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('get returns the object body as a stream', async () => {
    const body = Readable.from('bytes');
    send.mockResolvedValue({ Body: body });

    await expect(driverWith().get(key)).resolves.toBe(body);
  });

  it('get maps an empty body to NotFound', async () => {
    send.mockResolvedValue({ Body: undefined });

    await expect(driverWith().get(key)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('get maps NoSuchKey to NotFound', async () => {
    send.mockRejectedValue(
      Object.assign(new Error('gone'), { name: 'NoSuchKey' }),
    );

    await expect(driverWith().get(key)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('get maps a 404 status to NotFound', async () => {
    send.mockRejectedValue({ $metadata: { httpStatusCode: 404 } });

    await expect(driverWith().get(key)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('get surfaces other failures as server errors', async () => {
    send.mockRejectedValue(new Error('network down'));

    await expect(driverWith().get(key)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('delete removes the object', async () => {
    send.mockResolvedValue({});

    await expect(driverWith().delete(key)).resolves.toBeUndefined();
  });

  it('delete surfaces a failure', async () => {
    send.mockRejectedValue(new Error('denied'));

    await expect(driverWith().delete(key)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('exists reflects whether the head request succeeds', async () => {
    send.mockResolvedValue({});
    await expect(driverWith().exists(key)).resolves.toBe(true);

    send.mockRejectedValue(new Error('missing'));
    await expect(driverWith().exists(key)).resolves.toBe(false);
  });
});
