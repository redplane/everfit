import { chunk } from './chunk';

describe('chunk', () => {
  it('returns an empty array for empty input', () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it('splits an exact multiple into equal chunks', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('keeps a trailing remainder chunk', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single chunk when size exceeds the length', () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });

  it('throws RangeError when size is zero', () => {
    expect(() => chunk([1], 0)).toThrow(RangeError);
  });

  it('throws RangeError when size is not an integer', () => {
    expect(() => chunk([1], 1.5)).toThrow(RangeError);
  });
});
