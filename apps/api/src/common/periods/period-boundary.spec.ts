import { computePeriodComparisonWindows } from './period-boundary';
import { PeriodGranularity } from '../../models/periods/period-granularity';

const HCM = 'Asia/Ho_Chi_Minh'; // UTC+7, no DST.
const NY = 'America/New_York'; // DST zone.

function iso(date: Date): string {
  return date.toISOString();
}

describe('computePeriodComparisonWindows', () => {
  //#region week (non-UTC zone)
  describe('week (Asia/Ho_Chi_Minh, UTC+7)', () => {
    it('buckets to the local ISO week (Monday 00:00 +07) and converts the boundaries to UTC', () => {
      // 2026-10-07T12:34:56Z = Wed 19:34 local (+07).
      const { current, previous } = computePeriodComparisonWindows(
        new Date('2026-10-07T12:34:56.000Z'),
        PeriodGranularity.WEEK,
        HCM,
      );

      // Mon 2026-10-05 00:00 +07 = 2026-10-04T17:00:00Z.
      expect(iso(current.start)).toBe('2026-10-04T17:00:00.000Z');
      expect(iso(current.end)).toBe('2026-10-11T17:00:00.000Z');
      expect(iso(previous.start)).toBe('2026-09-27T17:00:00.000Z');
      expect(iso(previous.end)).toBe('2026-10-04T17:00:00.000Z');
    });

    it('buckets by LOCAL week, not UTC (an instant that is local-Sunday but UTC-Monday stays in the local week)', () => {
      // 2026-10-11T16:30Z = Sun 23:30 local (+07) — still the 2026-10-05 local week.
      const { current } = computePeriodComparisonWindows(
        new Date('2026-10-11T16:30:00.000Z'),
        PeriodGranularity.WEEK,
        HCM,
      );

      expect(iso(current.start)).toBe('2026-10-04T17:00:00.000Z');
      expect(iso(current.end)).toBe('2026-10-11T17:00:00.000Z');
    });
  });
  //#endregion

  //#region month (non-UTC zone, incl. year rollover)
  describe('month (Asia/Ho_Chi_Minh, UTC+7)', () => {
    it('buckets to the local calendar month (1st 00:00 +07) in UTC', () => {
      const { current, previous } = computePeriodComparisonWindows(
        new Date('2026-10-09T00:00:00.000Z'),
        PeriodGranularity.MONTH,
        HCM,
      );

      expect(iso(current.start)).toBe('2026-09-30T17:00:00.000Z');
      expect(iso(current.end)).toBe('2026-10-31T17:00:00.000Z');
      expect(iso(previous.start)).toBe('2026-08-31T17:00:00.000Z');
      expect(iso(previous.end)).toBe('2026-09-30T17:00:00.000Z');
    });

    it('rolls the previous window back across the year boundary for a January local month', () => {
      // 2026-01-15T00:00Z = Jan 15 07:00 local (+07).
      const { current, previous } = computePeriodComparisonWindows(
        new Date('2026-01-15T00:00:00.000Z'),
        PeriodGranularity.MONTH,
        HCM,
      );

      expect(iso(current.start)).toBe('2025-12-31T17:00:00.000Z');
      expect(iso(current.end)).toBe('2026-01-31T17:00:00.000Z');
      expect(iso(previous.start)).toBe('2025-11-30T17:00:00.000Z');
      expect(iso(previous.end)).toBe('2025-12-31T17:00:00.000Z');
    });
  });
  //#endregion

  //#region year (non-UTC zone)
  describe('year (Asia/Ho_Chi_Minh, UTC+7)', () => {
    it('buckets to the local calendar year (Jan 1 00:00 +07) in UTC', () => {
      const { current, previous } = computePeriodComparisonWindows(
        new Date('2026-06-15T00:00:00.000Z'),
        PeriodGranularity.YEAR,
        HCM,
      );

      expect(iso(current.start)).toBe('2025-12-31T17:00:00.000Z');
      expect(iso(current.end)).toBe('2026-12-31T17:00:00.000Z');
      expect(iso(previous.start)).toBe('2024-12-31T17:00:00.000Z');
      expect(iso(previous.end)).toBe('2025-12-31T17:00:00.000Z');
    });
  });
  //#endregion

  //#region DST transition (America/New_York, spring-forward 2026-03-08)
  describe('DST transition (America/New_York)', () => {
    it('yields correct UTC bounds for a week whose previous window spans spring-forward (offset changes mid-window)', () => {
      // Week of Mon 2026-03-09 (after spring-forward on Sun 2026-03-08 02:00 -> 03:00).
      const { current, previous } = computePeriodComparisonWindows(
        new Date('2026-03-10T12:00:00.000Z'),
        PeriodGranularity.WEEK,
        NY,
      );

      // Current week starts Mon 2026-03-09 00:00 EDT (-04:00) = 04:00Z.
      expect(iso(current.start)).toBe('2026-03-09T04:00:00.000Z');
      expect(iso(current.end)).toBe('2026-03-16T04:00:00.000Z');
      // Previous week starts Mon 2026-03-02 00:00 EST (-05:00) = 05:00Z and ends at the EDT boundary
      // (04:00Z) — a 23h-shorter week the library handles.
      expect(iso(previous.start)).toBe('2026-03-02T05:00:00.000Z');
      expect(iso(previous.end)).toBe('2026-03-09T04:00:00.000Z');
    });

    it('yields correct UTC bounds for a month spanning spring-forward (start EST -05:00, end EDT -04:00)', () => {
      const { current } = computePeriodComparisonWindows(
        new Date('2026-03-15T12:00:00.000Z'),
        PeriodGranularity.MONTH,
        NY,
      );

      expect(iso(current.start)).toBe('2026-03-01T05:00:00.000Z');
      expect(iso(current.end)).toBe('2026-04-01T04:00:00.000Z');
    });
  });
  //#endregion

  //#region UTC sanity + guard
  describe('UTC zone sanity', () => {
    it('reduces to plain UTC calendar bounds for week/month/year', () => {
      const now = new Date('2026-10-07T12:00:00.000Z');

      const week = computePeriodComparisonWindows(now, PeriodGranularity.WEEK, 'UTC');
      expect(iso(week.current.start)).toBe('2026-10-05T00:00:00.000Z');
      expect(iso(week.current.end)).toBe('2026-10-12T00:00:00.000Z');

      const month = computePeriodComparisonWindows(now, PeriodGranularity.MONTH, 'UTC');
      expect(iso(month.current.start)).toBe('2026-10-01T00:00:00.000Z');
      expect(iso(month.current.end)).toBe('2026-11-01T00:00:00.000Z');

      const year = computePeriodComparisonWindows(now, PeriodGranularity.YEAR, 'UTC');
      expect(iso(year.current.start)).toBe('2026-01-01T00:00:00.000Z');
      expect(iso(year.current.end)).toBe('2027-01-01T00:00:00.000Z');
    });
  });

  it('throws for an unknown granularity (defensive default branch)', () => {
    expect(() =>
      computePeriodComparisonWindows(
        new Date('2026-10-07T12:00:00.000Z'),
        'decade' as PeriodGranularity,
        'UTC',
      ),
    ).toThrow();
  });
  //#endregion
});
