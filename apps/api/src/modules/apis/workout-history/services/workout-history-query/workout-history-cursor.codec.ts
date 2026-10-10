/** The decoded keyset position carried by a history cursor. */
export interface WorkoutHistoryCursor {
  //#region Properties
  performedAt: Date;
  id: string;
  //#endregion
}

/** Serialized cursor payload (short keys to keep the opaque token small). */
interface CursorPayload {
  p: string;
  i: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Encodes a keyset position `(performedAt, id)` into an opaque base64url cursor. The payload is the
 * `performed_at` as an ISO string plus the entry `id`.
 */
export function encodeCursor(cursor: WorkoutHistoryCursor): string {
  const payload: CursorPayload = { p: cursor.performedAt.toISOString(), i: cursor.id };

  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/**
 * Decodes an opaque base64url cursor back into its keyset position. Returns `null` for any malformed
 * input (bad base64, non-JSON, missing/invalid `p`/`i`) so the caller can surface a single, uniform
 * `ValidationException` (INVALID_CURSOR → 400). Never throws.
 */
export function decodeCursor(raw: string): WorkoutHistoryCursor | null {
  let payload: unknown;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    payload = JSON.parse(json);
  } catch {
    return null;
  }

  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const { p, i } = payload as Record<string, unknown>;
  if (typeof p !== 'string' || typeof i !== 'string') {
    return null;
  }

  if (!UUID_PATTERN.test(i)) {
    return null;
  }

  const performedAt = new Date(p);
  if (Number.isNaN(performedAt.getTime())) {
    return null;
  }

  return { performedAt, id: i };
}
