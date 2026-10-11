import { PeriodWindow } from './period-window';

/**
 * The two windows the PR comparison (F8) aggregates over: the `current` period and the `previous`
 * (immediately preceding) period of the chosen granularity. Both are half-open UTC `[start, end)`
 * windows derived from the injected "now" in a caller-supplied timezone.
 */
export interface PeriodComparisonWindows {
  //#region Properties
  current: PeriodWindow;
  previous: PeriodWindow;
  //#endregion
}
