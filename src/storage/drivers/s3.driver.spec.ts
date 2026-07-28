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
