/**
 * Input for creating a muscle-group master record. Used by the muscle-group service's `createAsync`
 * (consumed by the seed CLI in Task 9). The id and `createdTime` are assigned by the service,
 * not supplied here.
 */
export interface CreateMuscleGroupOptions {
  //#region Properties
  name: string;
  //#endregion
}
