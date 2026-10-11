import { Injectable } from '@nestjs/common';
import { ITimeContext } from './time-context.interface';

@Injectable()
export class TimeContext implements ITimeContext {
  //#region Methods
  /**
   * Returns the current instant in UTC. This is the only place in the codebase allowed to
   * read the system clock via `new Date()`; everything else depends on this context so time
   * stays deterministic (and fakeable) in tests.
   */
  public async getUtcNowAsync(): Promise<Date> {
    return new Date();
  }
  //#endregion
}
