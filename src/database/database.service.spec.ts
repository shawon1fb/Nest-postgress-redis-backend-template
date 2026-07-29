import { drizzle } from 'drizzle-orm/node-postgres';
import { DatabaseService } from './database.service';

type Rows = unknown[];

/**
 * Chainable Drizzle stand-in: every builder method returns itself, and the
 * chain resolves to the queued rows when awaited.
 */
const dbMock = () => {
  const queue: Rows[] = [];
  const calls: string[] = [];

  const chain = (rows: Rows): unknown => {
    const proxy: unknown = new Proxy(
      {},
      {
        get(_target, property) {
          if (property === 'then') {
            return (resolve: (value: Rows) => unknown) =>
              Promise.resolve(rows).then(resolve);
          }
          return () => proxy;
        },
      },
    );
    return proxy;
  };

  const builder = (name: string) =>
    jest.fn(() => {
      calls.push(name);
      return chain(queue.shift() ?? []);
    });

  const db = {
    select: builder('select'),
    insert: builder('insert'),
    update: builder('update'),
    delete: builder('delete'),
    execute: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  } as unknown as ReturnType<typeof drizzle>;

  return { db, queue, calls };
};

describe('DatabaseService', () => {
  const user = { id: 'user-id', email: 'a@b.com' };
  let mock: ReturnType<typeof dbMock>;
  let service: DatabaseService;

  beforeEach(() => {
    mock = dbMock();
    service = new DatabaseService(mock.db);
  });

  it('exposes the raw connection for complex queries', () => {
    expect(service.getDatabase()).toBe(mock.db);
  });

  it('createUser returns the inserted row', async () => {
    mock.queue.push([user]);

    await expect(
      service.createUser({ email: 'a@b.com' } as never),
    ).resolves.toBe(user);
    expect(mock.calls).toContain('insert');
  });

  it('getUserById returns the matching row', async () => {
    mock.queue.push([user]);

    await expect(service.getUserById('user-id')).resolves.toBe(user);
  });

  it('getUserById resolves undefined when nothing matches', async () => {
    mock.queue.push([]);

    await expect(service.getUserById('missing')).resolves.toBeUndefined();
  });

  it('getUserByEmail returns the matching row', async () => {
    mock.queue.push([user]);

    await expect(service.getUserByEmail('a@b.com')).resolves.toBe(user);
  });

  it('updateUser returns the updated row', async () => {
    mock.queue.push([{ ...user, email: 'new@b.com' }]);

    await expect(
      service.updateUser('user-id', { email: 'new@b.com' }),
    ).resolves.toMatchObject({ email: 'new@b.com' });
    expect(mock.calls).toContain('update');
  });

  it('deleteUser issues a delete', async () => {
    mock.queue.push([user]);

    await service.deleteUser('user-id');

    expect(mock.calls).toContain('delete');
  });

  it('healthCheck reports healthy when the probe query succeeds', async () => {
    mock.queue.push([user]);

    await expect(service.healthCheck()).resolves.toMatchObject({
      status: 'healthy',
      timestamp: expect.any(Date) as Date,
    });
  });

  it('healthCheck reports unhealthy with the reason when the probe fails', async () => {
    (mock.db as unknown as { select: jest.Mock }).select.mockImplementation(
      () => {
        throw new Error('connection refused');
      },
    );

    await expect(service.healthCheck()).resolves.toMatchObject({
      status: 'unhealthy',
      error: 'connection refused',
    });
  });
});
