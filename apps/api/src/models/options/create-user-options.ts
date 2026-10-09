/**
 * Input for creating a user master record. Used by the user service's `createAsync`
 * (consumed by the seed CLI in Task 9). The id and `createdTime` are assigned by the service,
 * not supplied here.
 */
export interface CreateUserOptions {
  //#region Properties
  name: string;
  //#endregion
}
