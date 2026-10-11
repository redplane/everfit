import { GetPersonalRecordComparisonQueryDto } from '../../dto/get-personal-record-comparison-query.dto';
import { PersonalRecordComparisonDto } from '../../dto/personal-record-comparison.dto';

/**
 * Orchestration contract for the PR period comparison (F8). Consumed by the thin controller via the
 * `SERVICE__PERSONAL_RECORD_COMPARISON` token. Validates that the user and exercise exist, derives the
 * current and previous period windows (timezone-aware, from the injected clock), runs the Task 7
 * aggregation per window, converts the weight-scaled values to the requested unit, and computes the
 * per-metric delta (direction/percent on kg).
 */
export interface IPersonalRecordComparisonService {
  //#region Methods
  compareAsync(query: GetPersonalRecordComparisonQueryDto): Promise<PersonalRecordComparisonDto>;
  //#endregion
}
