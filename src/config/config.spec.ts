import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AppConfig } from './app.config';
import { BullMQRedisConfig } from './bull.config';
import { DatabaseConfig } from './database.config';
import { I18nConfig } from './i18n.config';
import { RedisConfig } from './redis.config';
import { SeederConfig } from './seeder.config';
import { StorageConfig, StorageDriverName } from './storage.config';
import { SwaggerConfig } from './swagger.config';
import { toBoolean, toInt, toNumber } from './parsers';

describe('config parsers', () => {
  it('toInt parses decimal strings', () => {
    expect(toInt('3000')).toBe(3000);
    expect(toInt(42)).toBe(42);
    expect(Number.isNaN(toInt('abc'))).toBe(true);
  });

  it('toNumber keeps fractional values', () => {
    expect(toNumber('1.5')).toBe(1.5);
    expect(toNumber(2)).toBe(2);
  });

  it('toBoolean treats only true/"true" as true', () => {
    expect(toBoolean(true)).toBe(true);
    expect(toBoolean('true')).toBe(true);
    expect(toBoolean('TRUE')).toBe(true);
    // The whole point: the string "false" must not be truthy.
    expect(toBoolean('false')).toBe(false);
    expect(toBoolean('')).toBe(false);
    expect(toBoolean(undefined)).toBe(false);
  });
});

describe('AppConfig', () => {
  const build = (overrides: Partial<AppConfig>) =>
    Object.assign(new AppConfig(), overrides);

  it('reports production only for NODE_ENV=production', () => {
    expect(build({ nodeEnv: 'production' }).isProduction).toBe(true);
    expect(build({ nodeEnv: 'development' }).isProduction).toBe(false);
    expect(build({ nodeEnv: 'test' }).isProduction).toBe(false);
  });

  it('accepts a valid set of values', () => {
    const config = plainToInstance(AppConfig, {
      port: 3000,
      nodeEnv: 'development',
      apiPrefix: 'api/v1',
      jwtSecret: 's',
      jwtRefreshSecret: 'r',
      jwtExpiresIn: '15m',
      jwtRefreshExpiresIn: '7d',
      bcryptRounds: 12,
      rateLimitTtl: 60,
      rateLimitLimit: 100,
    });

    expect(validateSync(config)).toEqual([]);
  });

  it.each([
    ['port out of range', { port: 99999 }],
    ['unknown nodeEnv', { nodeEnv: 'staging' }],
    ['non-integer bcryptRounds', { bcryptRounds: 'abc' }],
    ['bcryptRounds below the floor', { bcryptRounds: 2 }],
  ])('rejects %s', (_label, patch) => {
    const config = plainToInstance(AppConfig, {
      port: 3000,
      nodeEnv: 'development',
      apiPrefix: 'api/v1',
      jwtSecret: 's',
      jwtRefreshSecret: 'r',
      jwtExpiresIn: '15m',
      jwtRefreshExpiresIn: '7d',
      bcryptRounds: 12,
      rateLimitTtl: 60,
      rateLimitLimit: 100,
      ...patch,
    });

    expect(validateSync(config).length).toBeGreaterThan(0);
  });
});

describe('DatabaseConfig', () => {
  const build = (overrides: Partial<DatabaseConfig>) =>
    Object.assign(new DatabaseConfig(), {
      host: 'localhost',
      port: 5432,
      database: 'app',
      username: 'user',
      password: 'pass',
      ssl: false,
      ...overrides,
    });

  it('builds a plain connection URL when SSL is off', () => {
    expect(build({}).getDatabaseUrl()).toBe(
      'postgresql://user:pass@localhost:5432/app',
    );
  });

  it('appends sslmode only when SSL is on', () => {
    expect(build({ ssl: true }).getDatabaseUrl()).toContain('?sslmode=require');
  });
});

describe('RedisConfig / BullMQRedisConfig', () => {
  it('holds the connection values it is given', () => {
    const redis = Object.assign(new RedisConfig(), {
      host: 'redis',
      port: 6379,
      password: '',
      ttl: 1000,
    });
    const bull = Object.assign(new BullMQRedisConfig(), {
      host: 'redis-bullmq',
      port: 6380,
      password: '',
    });

    expect(redis.host).toBe('redis');
    expect(redis.ttl).toBe(1000);
    expect(bull.port).toBe(6380);
  });

  it('rejects a port outside the valid range', () => {
    const config = plainToInstance(RedisConfig, {
      host: 'redis',
      port: 70000,
      password: '',
      ttl: 1000,
    });

    expect(validateSync(config).length).toBeGreaterThan(0);
  });
});

describe('SwaggerConfig', () => {
  it('carries the documentation settings', () => {
    const config = Object.assign(new SwaggerConfig(), {
      title: 'API',
      description: 'desc',
      version: '1.0.0',
      path: '/api/docs',
      enabled: true,
    });

    expect(config.enabled).toBe(true);
    expect(config.path).toBe('/api/docs');
  });

  it('requires enabled to be a real boolean', () => {
    const config = plainToInstance(SwaggerConfig, {
      title: 'API',
      description: 'desc',
      version: '1.0.0',
      path: '/api/docs',
      enabled: 'false',
    });

    expect(validateSync(config).length).toBeGreaterThan(0);
  });
});

describe('SeederConfig', () => {
  const build = (environment: string) =>
    Object.assign(new SeederConfig(), {
      userCount: 50,
      clearExisting: true,
      verboseLogging: true,
      environment,
      batchSize: 10,
    });

  it('detects a production-like environment name', () => {
    expect(build('production').isProductionEnvironment()).toBe(true);
    expect(build('prod').isProductionEnvironment()).toBe(true);
    expect(build('PRODUCTION').isProductionEnvironment()).toBe(true);
    expect(build('development').isProductionEnvironment()).toBe(false);
  });

  it('exposes a role distribution that sums to one', () => {
    const distribution = build('development').getUserRoleDistribution();
    const total =
      distribution.admin + distribution.moderator + distribution.user;

    expect(total).toBeCloseTo(1);
  });
});

describe('I18nConfig', () => {
  it('splits and trims the supported language list', () => {
    const config = Object.assign(new I18nConfig(), {
      fallbackLanguage: 'en',
      headerName: 'x-lang',
      supportedLanguages: ' en , bn ,, ',
      watch: false,
    });

    expect(config.supportedLanguageList).toEqual(['en', 'bn']);
  });
});

describe('StorageConfig', () => {
  const build = (overrides: Partial<StorageConfig>) =>
    Object.assign(new StorageConfig(), {
      driver: StorageDriverName.LOCAL,
      allowedMimeTypes: '',
      s3Endpoint: 'http://minio:9000',
      s3PublicEndpoint: '',
      ...overrides,
    });

  it('treats an empty allow-list as "accept anything"', () => {
    expect(build({}).allowedMimeTypeList).toEqual([]);
  });

  it('splits and trims the MIME allow-list', () => {
    expect(
      build({ allowedMimeTypes: ' image/png , application/pdf ,' })
        .allowedMimeTypeList,
    ).toEqual(['image/png', 'application/pdf']);
  });

  it('falls back to the internal endpoint for client URLs', () => {
    expect(build({}).s3ClientEndpoint).toBe('http://minio:9000');
  });

  it('prefers the public endpoint and trims trailing slashes', () => {
    expect(
      build({ s3PublicEndpoint: 'https://cdn.example.com//' }).s3ClientEndpoint,
    ).toBe('https://cdn.example.com');
  });

  it('rejects an unknown driver name', () => {
    const config = plainToInstance(StorageConfig, {
      driver: 'gcs',
      maxFileSize: 1,
      urlExpiresIn: 1,
      s3ForcePathStyle: false,
      s3Visibility: 'private',
    });

    expect(validateSync(config).length).toBeGreaterThan(0);
  });
});
