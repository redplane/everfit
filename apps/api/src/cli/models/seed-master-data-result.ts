/**
 * Summary of what `ISeedService.seedMasterDataAsync` created, so the bootstrap can log it and feed
 * `demoUserId` into the workout seed when no `--user` override is supplied.
 */
export interface SeedMasterDataResult {
  //#region Properties
  /** Ids of the created users. */
  userIds: string[];

  /** Ids of the created exercises. */
  exerciseIds: string[];

  /** Ids of the created muscle groups. */
  muscleGroupIds: string[];

  /** Number of exercise↔muscle-group mappings created (unique pairs). */
  mappingCount: number;

  /** The user designated to receive the large workout dataset. */
  demoUserId: string;
  //#endregion
}
