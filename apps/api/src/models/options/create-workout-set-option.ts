/**
 * Input for one set within a workout entry (F5). Fully computed by the logging orchestration service
 * before it reaches the core workout service: `setNumber` is assigned 1-based by array order, and
 * `weightKg` is the kg-normalized value derived from `weight` + `unit` via
 * `IScaleUnitConversionService.toBaseAsync`. The original `weight` / `unit` are preserved alongside.
 */
export interface CreateWorkoutSetOption {
  //#region Properties
  setNumber: number;
  reps: number;
  weight: number;
  unit: string;
  weightKg: number;
  //#endregion
}
