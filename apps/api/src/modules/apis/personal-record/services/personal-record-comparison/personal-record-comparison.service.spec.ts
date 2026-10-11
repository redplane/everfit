import { PersonalRecordComparisonService } from './personal-record-comparison.service';
import { GetPersonalRecordComparisonQueryDto } from '../../dto/get-personal-record-comparison-query.dto';
import { PeriodGranularity } from '../../../../../models/periods/period-granularity';
import { PersonalRecordDeltaDirection } from '../../../../../models/results/personal-record-delta-direction';
import { IUserService } from '../../../../cores/user/services/user/user-service.interface';
import { UserByIdNotFoundException } from '../../../../cores/user/exceptions/user-by-id-not-found.exception';
import { IExerciseService } from '../../../../cores/exercise/services/exercise/exercise-service.interface';
import { ExerciseByIdNotFoundException } from '../../../../cores/exercise/exceptions/exercise-by-id-not-found.exception';
import { IScaleUnitConversionService } from '../../../../cores/scale-unit/services/scale-unit-conversion/scale-unit-conversion-service.interface';
import { IWorkoutService } from '../../../../cores/workout/services/workout/workout-service.interface';
import { ITimeContext } from '../../../../../common/time-context/time-context.interface';
import {
  PersonalRecordAggregate,
  PersonalRecordWinner,
} from '../../../../../models/results/personal-record-aggregate';
import { PersonalRecordCriteria } from '../../../../../models/criteria/personal-record-criteria';

const USER_ID = '018f6b0a-0000-7000-8000-000000000001';
const EXERCISE_ID = '018f6b0a-0000-7000-8000-0000000000a1';
const HCM = 'Asia/Ho_Chi_Minh';

// Fixed clock: 2026-10-07T12:00:00Z. In Asia/Ho_Chi_Minh (UTC+7) the month windows (computed locally,
// in UTC) are:
//   current  = [2026-09-30T17:00:00Z, 2026-10-31T17:00:00Z)
//   previous = [2026-08-31T17:00:00Z, 2026-09-30T17:00:00Z)
const NOW = new Date('2026-10-07T12:00:00.000Z');
const MONTH_CURRENT_START = '2026-09-30T17:00:00.000Z';
const MONTH_PREVIOUS_START = '2026-08-31T17:00:00.000Z';

const DAY_CURRENT = new Date('2026-10-02T10:00:00.000Z');
const DAY_PREVIOUS = new Date('2026-09-02T10:00:00.000Z');

const EMPTY_AGGREGATE: PersonalRecordAggregate = {
  maxWeight: null,
  maxVolume: null,
  best1Rm: null,
};

class StubUserService implements Partial<IUserService> {
  public exists = true;
  public existsByIdAsync = jest.fn(() => Promise.resolve(this.exists));
}

class StubExerciseService implements Partial<IExerciseService> {
  public exists = true;
  public existsByIdAsync = jest.fn(() => Promise.resolve(this.exists));
}

class StubScaleUnitConversionService implements Partial<IScaleUnitConversionService> {
  // Deterministic display conversion: kg -> value; lb -> value / 0.45359237 (2 dp). Handles negatives.
  public fromBaseAsync = jest.fn((valueBase: number, code: string) => {
    const converted = code === 'lb' ? valueBase / 0.45359237 : valueBase;
    return Promise.resolve(Math.round(converted * 100) / 100);
  });
}

class StubTimeContext implements ITimeContext {
  public now = NOW;
  public getUtcNowAsync = jest.fn(() => Promise.resolve(this.now));
}

/**
 * Returns the `current` aggregate when the criteria's `from` matches the current window start,
 * otherwise the `previous` aggregate — so a single service call fans out to the right window.
 */
class StubWorkoutService implements Partial<IWorkoutService> {
  public currentStartIso = MONTH_CURRENT_START;
  public current: PersonalRecordAggregate = EMPTY_AGGREGATE;
  public previous: PersonalRecordAggregate = EMPTY_AGGREGATE;
  public calls: PersonalRecordCriteria[] = [];

  public getPersonalRecordsAsync = jest.fn((criteria: PersonalRecordCriteria) => {
    this.calls.push(criteria);
    const isCurrent = criteria.from?.toISOString() === this.currentStartIso;
    return Promise.resolve(isCurrent ? this.current : this.previous);
  });
}

function winner(overrides: Partial<PersonalRecordWinner> & { weightKg: number }): PersonalRecordWinner {
  return { reps: 5, achievedAt: DAY_CURRENT, ...overrides };
}

function query(
  overrides?: Partial<GetPersonalRecordComparisonQueryDto>,
): GetPersonalRecordComparisonQueryDto {
  return {
    userId: USER_ID,
    exerciseId: EXERCISE_ID,
    granularity: PeriodGranularity.MONTH,
    timezone: HCM,
    unit: 'kg',
    ...overrides,
  };
}

describe('PersonalRecordComparisonService', () => {
  let userService: StubUserService;
  let exerciseService: StubExerciseService;
  let conversionService: StubScaleUnitConversionService;
  let workoutService: StubWorkoutService;
  let timeContext: StubTimeContext;
  let service: PersonalRecordComparisonService;

  beforeEach(() => {
    userService = new StubUserService();
    exerciseService = new StubExerciseService();
    conversionService = new StubScaleUnitConversionService();
    workoutService = new StubWorkoutService();
    timeContext = new StubTimeContext();
    service = new PersonalRecordComparisonService(
      userService as unknown as IUserService,
      exerciseService as unknown as IExerciseService,
      conversionService as unknown as IScaleUnitConversionService,
      workoutService as unknown as IWorkoutService,
      timeContext,
    );
  });

  //#region compareAsync
  describe('compareAsync', () => {
    it('passes the correct current/previous UTC month windows (non-UTC zone) to the aggregation', async () => {
      await service.compareAsync(query({ granularity: PeriodGranularity.MONTH }));

      const froms = workoutService.calls.map((c) => c.from?.toISOString());
      const tos = workoutService.calls.map((c) => c.to?.toISOString());
      expect(froms).toContain('2026-09-30T17:00:00.000Z');
      expect(tos).toContain('2026-10-31T17:00:00.000Z');
      expect(froms).toContain('2026-08-31T17:00:00.000Z');
      expect(tos).toContain('2026-09-30T17:00:00.000Z');
      // The injected clock is the only time source.
      expect(timeContext.getUtcNowAsync).toHaveBeenCalledTimes(1);
    });

    it('passes the correct current/previous UTC week windows (non-UTC zone) to the aggregation', async () => {
      workoutService.currentStartIso = '2026-10-04T17:00:00.000Z';

      await service.compareAsync(query({ granularity: PeriodGranularity.WEEK }));

      const froms = workoutService.calls.map((c) => c.from?.toISOString());
      const tos = workoutService.calls.map((c) => c.to?.toISOString());
      expect(froms).toEqual(
        expect.arrayContaining(['2026-10-04T17:00:00.000Z', '2026-09-27T17:00:00.000Z']),
      );
      expect(tos).toEqual(
        expect.arrayContaining(['2026-10-11T17:00:00.000Z', '2026-10-04T17:00:00.000Z']),
      );
    });

    it('passes the correct current/previous UTC year windows (non-UTC zone) to the aggregation', async () => {
      workoutService.currentStartIso = '2025-12-31T17:00:00.000Z';

      await service.compareAsync(query({ granularity: PeriodGranularity.YEAR }));

      const froms = workoutService.calls.map((c) => c.from?.toISOString());
      const tos = workoutService.calls.map((c) => c.to?.toISOString());
      expect(froms).toEqual(
        expect.arrayContaining(['2025-12-31T17:00:00.000Z', '2024-12-31T17:00:00.000Z']),
      );
      expect(tos).toEqual(
        expect.arrayContaining(['2026-12-31T17:00:00.000Z', '2025-12-31T17:00:00.000Z']),
      );
    });

    it('returns the UTC period boundaries, granularity, timezone, and unit on the response', async () => {
      const result = await service.compareAsync(query());

      expect(result.userId).toBe(USER_ID);
      expect(result.exerciseId).toBe(EXERCISE_ID);
      expect(result.granularity).toBe(PeriodGranularity.MONTH);
      expect(result.timezone).toBe(HCM);
      expect(result.unit).toBe('kg');
      expect(result.current.periodStart.toISOString()).toBe('2026-09-30T17:00:00.000Z');
      expect(result.current.periodEnd.toISOString()).toBe('2026-10-31T17:00:00.000Z');
      expect(result.previous.periodStart.toISOString()).toBe('2026-08-31T17:00:00.000Z');
      expect(result.previous.periodEnd.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    });

    it('computes an "up" delta (absolute positive, percent on kg) when current > previous', async () => {
      workoutService.current = {
        maxWeight: winner({ weightKg: 120, reps: 3, achievedAt: DAY_CURRENT }),
        maxVolume: null,
        best1Rm: null,
      };
      workoutService.previous = {
        maxWeight: winner({ weightKg: 100, reps: 5, achievedAt: DAY_PREVIOUS }),
        maxVolume: null,
        best1Rm: null,
      };

      const result = await service.compareAsync(query());

      expect(result.delta.maxWeight.direction).toBe(PersonalRecordDeltaDirection.UP);
      expect(result.delta.maxWeight.absolute).toBe(20);
      expect(result.delta.maxWeight.percent).toBe(20); // (20 / 100) * 100.
    });

    it('computes a "down" delta (absolute negative) when current < previous', async () => {
      workoutService.current = {
        maxWeight: winner({ weightKg: 80 }),
        maxVolume: null,
        best1Rm: null,
      };
      workoutService.previous = {
        maxWeight: winner({ weightKg: 100 }),
        maxVolume: null,
        best1Rm: null,
      };

      const result = await service.compareAsync(query());

      expect(result.delta.maxWeight.direction).toBe(PersonalRecordDeltaDirection.DOWN);
      expect(result.delta.maxWeight.absolute).toBe(-20);
      expect(result.delta.maxWeight.percent).toBe(-20);
    });

    it('computes a "same" delta (absolute 0, percent 0) when current equals previous', async () => {
      workoutService.current = {
        maxWeight: winner({ weightKg: 100 }),
        maxVolume: null,
        best1Rm: null,
      };
      workoutService.previous = {
        maxWeight: winner({ weightKg: 100 }),
        maxVolume: null,
        best1Rm: null,
      };

      const result = await service.compareAsync(query());

      expect(result.delta.maxWeight.direction).toBe(PersonalRecordDeltaDirection.SAME);
      expect(result.delta.maxWeight.absolute).toBe(0);
      expect(result.delta.maxWeight.percent).toBe(0);
    });

    it('reports "new" (null absolute/percent) when previous is null but current is present', async () => {
      workoutService.current = {
        maxWeight: winner({ weightKg: 100 }),
        maxVolume: null,
        best1Rm: null,
      };
      workoutService.previous = EMPTY_AGGREGATE;

      const result = await service.compareAsync(query());

      expect(result.delta.maxWeight.direction).toBe(PersonalRecordDeltaDirection.NEW);
      expect(result.delta.maxWeight.absolute).toBeNull();
      expect(result.delta.maxWeight.percent).toBeNull();
    });

    it('reports "same"/nulls when the metric is absent in both periods', async () => {
      workoutService.current = EMPTY_AGGREGATE;
      workoutService.previous = EMPTY_AGGREGATE;

      const result = await service.compareAsync(query());

      expect(result.delta.maxWeight.direction).toBe(PersonalRecordDeltaDirection.SAME);
      expect(result.delta.maxWeight.absolute).toBeNull();
      expect(result.delta.maxWeight.percent).toBeNull();
    });

    it('reports "none" (null absolute/percent) when current is null but previous was present', async () => {
      workoutService.current = EMPTY_AGGREGATE;
      workoutService.previous = {
        maxWeight: winner({ weightKg: 100, achievedAt: DAY_PREVIOUS }),
        maxVolume: null,
        best1Rm: null,
      };

      const result = await service.compareAsync(query());

      expect(result.delta.maxWeight.direction).toBe(PersonalRecordDeltaDirection.NONE);
      expect(result.delta.maxWeight.absolute).toBeNull();
      expect(result.delta.maxWeight.percent).toBeNull();
    });

    it('uses the headline kg scalar per metric (volumeKg for max-volume, oneRepMaxKg for best-1RM)', async () => {
      workoutService.current = {
        maxWeight: null,
        maxVolume: winner({ weightKg: 90, reps: 12, volumeKg: 1080, achievedAt: DAY_CURRENT }),
        best1Rm: winner({ weightKg: 115, reps: 8, oneRepMaxKg: 145, achievedAt: DAY_CURRENT }),
      };
      workoutService.previous = {
        maxWeight: null,
        maxVolume: winner({ weightKg: 80, reps: 10, volumeKg: 800, achievedAt: DAY_PREVIOUS }),
        best1Rm: winner({ weightKg: 100, reps: 8, oneRepMaxKg: 120, achievedAt: DAY_PREVIOUS }),
      };

      const result = await service.compareAsync(query());

      // Volume: 1080 - 800 = 280 kg.
      expect(result.delta.maxVolume.direction).toBe(PersonalRecordDeltaDirection.UP);
      expect(result.delta.maxVolume.absolute).toBe(280);
      // 1RM: 145 - 120 = 25 kg.
      expect(result.delta.best1Rm.absolute).toBe(25);
    });

    it('builds the current period block with null metrics (empty-not-error) when the current period has no data', async () => {
      workoutService.current = EMPTY_AGGREGATE;
      workoutService.previous = {
        maxWeight: winner({ weightKg: 100, achievedAt: DAY_PREVIOUS }),
        maxVolume: null,
        best1Rm: null,
      };

      const result = await service.compareAsync(query());

      expect(result.current.maxWeight).toBeNull();
      expect(result.current.maxVolume).toBeNull();
      expect(result.current.best1Rm).toBeNull();
      expect(result.previous.maxWeight).not.toBeNull();
    });

    it('converts the delta absolute and the block weights to the requested unit (delta computed on kg)', async () => {
      workoutService.current = {
        maxWeight: winner({ weightKg: 120, reps: 3, achievedAt: DAY_CURRENT }),
        maxVolume: null,
        best1Rm: null,
      };
      workoutService.previous = {
        maxWeight: winner({ weightKg: 100, reps: 5, achievedAt: DAY_PREVIOUS }),
        maxVolume: null,
        best1Rm: null,
      };

      const result = await service.compareAsync(query({ unit: 'lb' }));

      // Block weight: 120 kg -> 264.55 lb.
      expect(result.current.maxWeight?.weight).toBeCloseTo(264.55, 1);
      // Delta computed on kg (20) then converted: 20 kg -> 44.09 lb.
      expect(conversionService.fromBaseAsync).toHaveBeenCalledWith(20, 'lb');
      expect(result.delta.maxWeight.absolute).toBeCloseTo(44.09, 1);
      // Percent is unit-independent (on kg).
      expect(result.delta.maxWeight.percent).toBe(20);
    });

    it('throws UserByIdNotFoundException (404) and does NOT aggregate when the user is unknown', async () => {
      userService.exists = false;

      await expect(service.compareAsync(query())).rejects.toBeInstanceOf(UserByIdNotFoundException);
      expect(exerciseService.existsByIdAsync).not.toHaveBeenCalled();
      expect(workoutService.getPersonalRecordsAsync).not.toHaveBeenCalled();
    });

    it('throws ExerciseByIdNotFoundException (404) before aggregation when the exercise is unknown', async () => {
      exerciseService.exists = false;

      await expect(service.compareAsync(query())).rejects.toBeInstanceOf(
        ExerciseByIdNotFoundException,
      );
      expect(workoutService.getPersonalRecordsAsync).not.toHaveBeenCalled();
    });
  });
  //#endregion
});
