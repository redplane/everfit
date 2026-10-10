import { GetPersonalRecordQueryDto } from '../../dto/get-personal-record-query.dto';
import { PersonalRecordDto } from '../../dto/personal-record.dto';

/**
 * Orchestration contract for the personal-record read (F7). Consumed by the thin controller via the
 * `SERVICE__PERSONAL_RECORD_QUERY` token. Validates that the user and exercise exist, runs the
 * index-backed PR aggregation (on kg), converts the weight-scaled values to the requested unit, and
 * builds the `PersonalRecordDto` (null metrics when the known exercise has no sets for the user).
 */
export interface IPersonalRecordQueryService {
  //#region Methods
  getAsync(query: GetPersonalRecordQueryDto): Promise<PersonalRecordDto>;
  //#endregion
}
