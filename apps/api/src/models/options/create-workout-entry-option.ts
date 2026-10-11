import { CreateWorkoutSetOption } from './create-workout-set-option';

/**
 * Input for one exercise entry within a (single or bulk) workout log (F5). `performedAt` is already
 * parsed to a `Date` (stored UTC). `sets` is non-empty and its `setNumber`s/`weightKg`s are
 * pre-computed by the orchestration service.
 */
export interface CreateWorkoutEntryOption {
  //#region Properties
  exerciseId: string;
  performedAt: Date;
  sets: CreateWorkoutSetOption[];
  //#endregion
}
