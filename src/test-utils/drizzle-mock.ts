import { DatabaseService } from '../database/database.service';

type Rows = unknown[];

export interface DrizzleMock {
  /** Stands in for `DatabaseService` in a service constructor. */
  databaseService: DatabaseService;
  /**
   * Rows returned by the next call to each builder, in order. Push one entry
   * per statement the code under test is expected to run.
   */
  queue: {
    select: Rows[];
    insert: Rows[];
    update: Rows[];
    delete: Rows[];
  };
  calls: {
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    /** Every `.set(...)` payload passed to an update, in order. */
    setPayloads: unknown[];
    /** Every `.values(...)` payload passed to an insert, in order. */
    valuePayloads: unknown[];
  };
}

/**
 * Minimal stand-in for the Drizzle query builder.
 *
 * Real queries are chains that are awaited at the end
 * (`db.select().from(t).where(c)`), and the services also build a query and
 * then bolt clauses on afterwards. A proxy that answers every method with
 * itself, and resolves to a queued row set when awaited, satisfies both shapes
 * without pulling in a database.
 */
export function createDrizzleMock(): DrizzleMock {
  const queue: DrizzleMock['queue'] = {
    select: [],
    insert: [],
    update: [],
    delete: [],
  };
  const setPayloads: unknown[] = [];
  const valuePayloads: unknown[] = [];

  const chain = (rows: Rows): unknown => {
    const proxy: unknown = new Proxy(
      {},
      {
        get(_target, property) {
          if (property === 'then') {
            return (resolve: (value: Rows) => unknown, reject: unknown) =>
              Promise.resolve(rows).then(resolve, reject as never);
          }
          return (...args: unknown[]) => {
            if (property === 'set') setPayloads.push(args[0]);
            if (property === 'values') valuePayloads.push(args[0]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  };

  const builder = (kind: keyof DrizzleMock['queue']) =>
    jest.fn(() => chain(queue[kind].shift() ?? []));

  const calls = {
    select: builder('select'),
    insert: builder('insert'),
    update: builder('update'),
    delete: builder('delete'),
    setPayloads,
    valuePayloads,
  };

  const databaseService = {
    getDatabase: () => calls,
  } as unknown as DatabaseService;

  return { databaseService, queue, calls };
}
