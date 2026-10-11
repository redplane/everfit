import { newDb, IMemoryDb } from 'pg-mem';
import { DataSource, Repository } from 'typeorm';
import { UserService } from './user.service';
import { UserEntity } from '../../entities/user.entity';
import { UserByIdNotFoundException } from '../../exceptions/user-by-id-not-found.exception';
import { ITimeContext } from '../../../../../common/time-context/time-context.interface';

/**
 * Deterministic fake clock so `createAsync` timestamps are assertable.
 */
class FakeTimeContext implements ITimeContext {
  public constructor(private readonly __now: Date) {}
  public getUtcNowAsync(): Promise<Date> {
    return Promise.resolve(this.__now);
  }
}

const FIXED_NOW = new Date('2026-10-10T08:30:00.000Z');

async function createInMemoryDataSource(): Promise<DataSource> {
  const db: IMemoryDb = newDb();

  // The TypeORM Postgres driver probes the server on connect; pg-mem ships very few native
  // functions, so register the one the driver calls.
  db.public.registerFunction({
    name: 'version',
    implementation: () => 'PostgreSQL 14.0 (pg-mem)',
  });
  db.public.registerFunction({
    name: 'current_database',
    implementation: () => 'test',
  });

  // Create the schema with raw DDL (mirrors the CreateUsers migration) rather than TypeORM's
  // `synchronize()`, whose introspection queries use functions pg-mem does not implement.
  db.public.none(`
    CREATE TABLE users (
      id uuid NOT NULL,
      name varchar(200) NOT NULL,
      created_time timestamptz NOT NULL,
      updated_time timestamptz NULL,
      CONSTRAINT pk_users PRIMARY KEY (id)
    );
  `);

  const dataSource: DataSource = db.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: [UserEntity],
  });

  await dataSource.initialize();

  return dataSource;
}

describe('UserService', () => {
  let dataSource: DataSource;
  let repository: Repository<UserEntity>;
  let service: UserService;

  beforeEach(async () => {
    dataSource = await createInMemoryDataSource();
    repository = dataSource.getRepository(UserEntity);
    service = new UserService(repository, new FakeTimeContext(FIXED_NOW));
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  //#region createAsync
  describe('createAsync', () => {
    it('persists a user with a generated UUID v7 id, the given name, and the clock timestamp', async () => {
      const created = await service.createAsync({ name: 'Alice' });

      expect(created.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(created.name).toBe('Alice');
      expect(created.createdTime).toEqual(FIXED_NOW);
      // Never updated yet: the nullable column comes back unset (null) after the insert reload.
      expect(created.updatedTime ?? null).toBeNull();

      const persisted = await repository.findOneBy({ id: created.id });
      expect(persisted).not.toBeNull();
      expect(persisted?.name).toBe('Alice');
    });
  });
  //#endregion

  //#region getByIdAsync
  describe('getByIdAsync', () => {
    it('returns the entity when it exists', async () => {
      const created = await service.createAsync({ name: 'Bob' });

      const found = await service.getByIdAsync(created.id);

      expect(found.id).toBe(created.id);
      expect(found.name).toBe('Bob');
    });

    it('throws UserByIdNotFoundException when no user has the id', async () => {
      await expect(
        service.getByIdAsync('00000000-0000-7000-8000-000000000000'),
      ).rejects.toBeInstanceOf(UserByIdNotFoundException);
    });
  });
  //#endregion

  //#region existsByIdAsync
  describe('existsByIdAsync', () => {
    it('returns true when a user with the id exists', async () => {
      const created = await service.createAsync({ name: 'Carol' });

      await expect(service.existsByIdAsync(created.id)).resolves.toBe(true);
    });

    it('returns false when no user with the id exists', async () => {
      await expect(
        service.existsByIdAsync('00000000-0000-7000-8000-000000000000'),
      ).resolves.toBe(false);
    });
  });
  //#endregion

  //#region searchAsync
  describe('searchAsync', () => {
    it('returns items ordered by name ASC with the full total', async () => {
      await service.createAsync({ name: 'Charlie' });
      await service.createAsync({ name: 'Alice' });
      await service.createAsync({ name: 'Bob' });

      const result = await service.searchAsync({ limit: 20, offset: 0 });

      expect(Object.keys(result).sort()).toEqual(['items', 'total'].sort());
      expect(result.total).toBe(3);
      expect('limit' in result).toBe(false);
      expect('offset' in result).toBe(false);
      expect(result.items.map((user) => user.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('breaks ties on equal names by id ASC (deterministic ordering)', async () => {
      const first = await service.createAsync({ name: 'Same' });
      const second = await service.createAsync({ name: 'Same' });

      const result = await service.searchAsync({ limit: 20, offset: 0 });

      // UUID v7 is time-ordered, so the earlier-created id sorts first.
      const [idA, idB] = [first.id, second.id].sort();
      expect(result.items.map((user) => user.id)).toEqual([idA, idB]);
    });

    it('respects limit (returns at most limit items; total is the full count)', async () => {
      await service.createAsync({ name: 'Alice' });
      await service.createAsync({ name: 'Bob' });
      await service.createAsync({ name: 'Charlie' });

      const result = await service.searchAsync({ limit: 2, offset: 0 });

      expect(result.items).toHaveLength(2);
      expect(result.items.map((user) => user.name)).toEqual(['Alice', 'Bob']);
      expect(result.total).toBe(3);
    });

    it('respects offset (returns the correct slice)', async () => {
      await service.createAsync({ name: 'Alice' });
      await service.createAsync({ name: 'Bob' });
      await service.createAsync({ name: 'Charlie' });

      const result = await service.searchAsync({ limit: 2, offset: 2 });

      expect(result.items.map((user) => user.name)).toEqual(['Charlie']);
      expect(result.total).toBe(3);
    });

    it('returns empty items (not an error) for a page beyond the data, with the correct total', async () => {
      await service.createAsync({ name: 'Alice' });

      const result = await service.searchAsync({ limit: 20, offset: 50 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(1);
    });

    it('returns empty items with total 0 when no users exist (not an error)', async () => {
      const result = await service.searchAsync({ limit: 20, offset: 0 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
  //#endregion
});
