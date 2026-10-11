import { newDb, IMemoryDb } from 'pg-mem';
import { DataSource, Repository } from 'typeorm';
import { MuscleGroupService } from './muscle-group.service';
import { MuscleGroupEntity } from '../../entities/muscle-group.entity';
import { MuscleGroupByIdNotFoundException } from '../../exceptions/muscle-group-by-id-not-found.exception';
import { ITimeContext } from '../../../../../common/time-context/time-context.interface';

class FakeTimeContext implements ITimeContext {
  public constructor(private readonly __now: Date) {}
  public getUtcNowAsync(): Promise<Date> {
    return Promise.resolve(this.__now);
  }
}

const FIXED_NOW = new Date('2026-10-10T08:30:00.000Z');
const MISSING_ID = '00000000-0000-7000-8000-000000000000';

async function createInMemoryDataSource(): Promise<DataSource> {
  const db: IMemoryDb = newDb();

  db.public.registerFunction({ name: 'version', implementation: () => 'PostgreSQL 14.0 (pg-mem)' });
  db.public.registerFunction({ name: 'current_database', implementation: () => 'test' });

  db.public.none(`
    CREATE TABLE muscle_groups (
      id uuid NOT NULL,
      name varchar(200) NOT NULL,
      created_time timestamptz NOT NULL,
      updated_time timestamptz NULL,
      CONSTRAINT pk_muscle_groups PRIMARY KEY (id),
      CONSTRAINT uq_muscle_groups_name UNIQUE (name)
    );
  `);

  const dataSource: DataSource = db.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: [MuscleGroupEntity],
  });

  await dataSource.initialize();

  return dataSource;
}

describe('MuscleGroupService', () => {
  let dataSource: DataSource;
  let repository: Repository<MuscleGroupEntity>;
  let service: MuscleGroupService;

  beforeEach(async () => {
    dataSource = await createInMemoryDataSource();
    repository = dataSource.getRepository(MuscleGroupEntity);
    service = new MuscleGroupService(repository, new FakeTimeContext(FIXED_NOW));
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  //#region createAsync
  describe('createAsync', () => {
    it('persists a muscle group with a generated UUID v7 id, the name, and the clock timestamp', async () => {
      const created = await service.createAsync({ name: 'Chest' });

      expect(created.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(created.name).toBe('Chest');
      expect(created.createdTime).toEqual(FIXED_NOW);
      expect(created.updatedTime ?? null).toBeNull();

      const persisted = await repository.findOneBy({ id: created.id });
      expect(persisted?.name).toBe('Chest');
    });
  });
  //#endregion

  //#region getByIdAsync
  describe('getByIdAsync', () => {
    it('returns the entity when it exists', async () => {
      const created = await service.createAsync({ name: 'Back' });

      const found = await service.getByIdAsync(created.id);

      expect(found.id).toBe(created.id);
      expect(found.name).toBe('Back');
    });

    it('throws MuscleGroupByIdNotFoundException when no muscle group has the id', async () => {
      await expect(service.getByIdAsync(MISSING_ID)).rejects.toBeInstanceOf(
        MuscleGroupByIdNotFoundException,
      );
    });
  });
  //#endregion

  //#region existsByIdAsync
  describe('existsByIdAsync', () => {
    it('returns true when a muscle group with the id exists', async () => {
      const created = await service.createAsync({ name: 'Legs' });

      await expect(service.existsByIdAsync(created.id)).resolves.toBe(true);
    });

    it('returns false when no muscle group with the id exists', async () => {
      await expect(service.existsByIdAsync(MISSING_ID)).resolves.toBe(false);
    });
  });
  //#endregion

  //#region searchAsync
  describe('searchAsync', () => {
    it('returns items ordered by name ASC with the full total', async () => {
      await service.createAsync({ name: 'Legs' });
      await service.createAsync({ name: 'Back' });
      await service.createAsync({ name: 'Chest' });

      const result = await service.searchAsync({ limit: 20, offset: 0 });

      expect(Object.keys(result).sort()).toEqual(['items', 'total'].sort());
      expect(result.total).toBe(3);
      expect('limit' in result).toBe(false);
      expect('offset' in result).toBe(false);
      expect(result.items.map((group) => group.name)).toEqual(['Back', 'Chest', 'Legs']);
    });

    it('respects limit (returns at most limit items; total is the full count)', async () => {
      await service.createAsync({ name: 'Legs' });
      await service.createAsync({ name: 'Back' });
      await service.createAsync({ name: 'Chest' });

      const result = await service.searchAsync({ limit: 2, offset: 0 });

      expect(result.items).toHaveLength(2);
      expect(result.items.map((group) => group.name)).toEqual(['Back', 'Chest']);
      expect(result.total).toBe(3);
    });

    it('respects offset (returns the correct slice)', async () => {
      await service.createAsync({ name: 'Legs' });
      await service.createAsync({ name: 'Back' });
      await service.createAsync({ name: 'Chest' });

      const result = await service.searchAsync({ limit: 2, offset: 2 });

      expect(result.items.map((group) => group.name)).toEqual(['Legs']);
      expect(result.total).toBe(3);
    });

    it('returns empty items (not an error) for a page beyond the data, with the correct total', async () => {
      await service.createAsync({ name: 'Chest' });

      const result = await service.searchAsync({ limit: 20, offset: 50 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(1);
    });

    it('returns empty items with total 0 when no muscle groups exist (not an error)', async () => {
      const result = await service.searchAsync({ limit: 20, offset: 0 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
  //#endregion
});
