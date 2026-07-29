import { DatabaseConfig } from '../config/database.config';

const poolInstances: Array<Record<string, unknown>> = [];
const endMock = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn(function (this: Record<string, unknown>, options: unknown) {
    poolInstances.push(options as Record<string, unknown>);
    this.end = endMock;
  }),
}));

jest.mock('drizzle-orm/node-postgres', () => ({
  drizzle: jest.fn(() => ({ marker: 'drizzle-instance' })),
}));

import {
  closeDatabaseConnection,
  createDatabaseConnection,
  getDatabaseConnection,
} from './connection';

const configWith = (overrides: Partial<DatabaseConfig> = {}) =>
  Object.assign(new DatabaseConfig(), {
    host: 'localhost',
    port: 5432,
    username: 'user',
    password: 'pass',
    database: 'app',
    ssl: false,
    ...overrides,
  });

describe('database connection', () => {
  beforeEach(() => {
    poolInstances.length = 0;
    endMock.mockClear();
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it('throws when asked for a connection before one is created', () => {
    expect(() => getDatabaseConnection()).toThrow(
      'Database connection not initialized',
    );
  });

  it('creates a pool from the config', () => {
    const connection = createDatabaseConnection(configWith());

    expect(connection).toMatchObject({ marker: 'drizzle-instance' });
    expect(poolInstances[0]).toMatchObject({
      host: 'localhost',
      port: 5432,
      user: 'user',
      database: 'app',
      ssl: false,
    });
  });

  it('reuses the existing connection on later calls', () => {
    const first = createDatabaseConnection(configWith());
    const second = createDatabaseConnection(configWith({ host: 'other' }));

    expect(second).toBe(first);
    // No second pool: the cached connection short-circuits.
    expect(poolInstances).toHaveLength(0);
  });

  it('returns the cached connection once initialized', () => {
    expect(getDatabaseConnection()).toMatchObject({
      marker: 'drizzle-instance',
    });
  });

  it('closes the pool and clears the cache', async () => {
    await closeDatabaseConnection();

    expect(endMock).toHaveBeenCalled();
  });
});
