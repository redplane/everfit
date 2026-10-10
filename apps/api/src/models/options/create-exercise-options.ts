/**
 * Input for creating an exercise master record. Used by the exercise service's `createAsync`
 * (consumed by the seed CLI in Task 9). The id and `createdTime` are assigned by the service,
 * not supplied here.
 */
export interface CreateExerciseOptions {
  //#region Properties
  name: string;
  //#endregion
}
