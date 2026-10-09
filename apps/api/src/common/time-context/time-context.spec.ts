import { TimeContext } from './time-context';

describe('getUtcNowAsync', () => {
  let timeContext: TimeContext;

  beforeEach(() => {
    timeContext = new TimeContext();
  });

  it('resolves with a Date instance', async () => {
    const now = await timeContext.getUtcNowAsync();

    expect(now).toBeInstanceOf(Date);
  });

  it('returns the current instant (within a small tolerance)', async () => {
    const before = Date.now();

    const now = await timeContext.getUtcNowAsync();

    const after = Date.now();
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });
});
