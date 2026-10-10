/**
 * Splits an array into consecutive sub-arrays of at most `size` elements, preserving order. Used by
 * the seed service to bulk-insert the large workout dataset in batches rather than row-by-row. Pure,
 * so its boundaries (empty input, exact multiple, trailing remainder) are directly unit-testable.
 *
 * @throws RangeError when `size` is not a positive integer.
 */
export function chunk<T>(items: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`chunk size must be a positive integer, received ${size}`);
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}
