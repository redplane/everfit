import { DateTime } from 'luxon';
import { PeriodGranularity } from '../../models/periods/period-granularity';
import { PeriodWindow } from '../../models/periods/period-window';
import { PeriodComparisonWindows } from '../../models/periods/period-comparison-windows';

/**
 * Maps a granularity to the luxon duration/unit used to step and bucket a period. `week` buckets to
 * the ISO week (Monday start); `month`/`year` to the calendar month/year.
 */
const GRANULARITY_UNIT: Record<PeriodGranularity, 'week' | 'month' | 'year'> = {
  [PeriodGranularity.WEEK]: 'week',
  [PeriodGranularity.MONTH]: 'month',
  [PeriodGranularity.YEAR]: 'year',
};

/**
 * Computes the current and previous period windows (F8) for a given instant, granularity, and IANA
 * timezone. Pure — `now` (a UTC instant) is passed in by the caller (from the injected time context);
 * this function never reads the clock itself.
 *
 * Boundaries are **local wall-clock** starts in `timezone` — week = Monday 00:00 local (ISO, luxon
 * `startOf('week')`), month = 1st 00:00 local, year = Jan 1 00:00 local — stepped by one period via
 * luxon `plus`/`minus` (calendar arithmetic, not fixed 7·24h), then materialized to **UTC instants**
 * via `toJSDate()`. luxon resolves the zone offset at each boundary instant, so windows spanning a DST
 * transition yield correct UTC bounds (a 23h/25h day is handled by the library, never by hand math).
 *
 * Both windows are half-open `[start, end)`.
 *
 * @throws Error if `granularity` is not a known `PeriodGranularity` (defensive; Joi constrains input).
 */
export function computePeriodComparisonWindows(
  now: Date,
  granularity: PeriodGranularity,
  timezone: string,
): PeriodComparisonWindows {
  const unit = GRANULARITY_UNIT[granularity];
  if (unit === undefined) {
    throw new Error(`Unsupported period granularity: ${granularity}`);
  }

  const localNow = DateTime.fromJSDate(now, { zone: timezone });

  const currentStart = localNow.startOf(unit);
  const currentEnd = currentStart.plus({ [unit]: 1 });
  const previousStart = currentStart.minus({ [unit]: 1 });

  const current: PeriodWindow = {
    start: currentStart.toJSDate(),
    end: currentEnd.toJSDate(),
  };
  const previous: PeriodWindow = {
    start: previousStart.toJSDate(),
    end: currentStart.toJSDate(),
  };

  return { current, previous };
}
