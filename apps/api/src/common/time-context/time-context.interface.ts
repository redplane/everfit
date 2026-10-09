export interface ITimeContext {
  //#region Methods
  getUtcNowAsync(): Promise<Date>;
  //#endregion
}
