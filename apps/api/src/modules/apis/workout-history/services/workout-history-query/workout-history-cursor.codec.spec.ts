import { decodeCursor, encodeCursor } from './workout-history-cursor.codec';

const PERFORMED_AT = new Date('2026-10-02T10:00:00.000Z');
const ID = '018f6b0a-0000-7000-8000-000000000002';

describe('encodeCursor', () => {
  it('produces an opaque base64url string that round-trips through decodeCursor', () => {
    const token = encodeCursor({ performedAt: PERFORMED_AT, id: ID });

    expect(typeof token).toBe('string');
    expect(token).not.toContain('{');

    const decoded = decodeCursor(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe(ID);
    expect(decoded?.performedAt.toISOString()).toBe(PERFORMED_AT.toISOString());
  });
});

describe('decodeCursor', () => {
  it('decodes a valid cursor into { performedAt, id }', () => {
    const token = encodeCursor({ performedAt: PERFORMED_AT, id: ID });

    const decoded = decodeCursor(token);

    expect(decoded).toEqual({ performedAt: PERFORMED_AT, id: ID });
  });

  it('returns null when the payload is not valid JSON', () => {
    const notJson = Buffer.from('not json at all', 'utf8').toString('base64url');

    expect(decodeCursor(notJson)).toBeNull();
  });

  it('returns null when the decoded JSON is not an object', () => {
    const jsonArray = Buffer.from('[1,2,3]', 'utf8').toString('base64url');

    expect(decodeCursor(jsonArray)).toBeNull();
  });

  it('returns null when `p` is missing', () => {
    const token = Buffer.from(JSON.stringify({ i: ID }), 'utf8').toString('base64url');

    expect(decodeCursor(token)).toBeNull();
  });

  it('returns null when `i` is missing', () => {
    const token = Buffer.from(
      JSON.stringify({ p: PERFORMED_AT.toISOString() }),
      'utf8',
    ).toString('base64url');

    expect(decodeCursor(token)).toBeNull();
  });

  it('returns null when `i` is not a UUID', () => {
    const token = Buffer.from(
      JSON.stringify({ p: PERFORMED_AT.toISOString(), i: 'not-a-uuid' }),
      'utf8',
    ).toString('base64url');

    expect(decodeCursor(token)).toBeNull();
  });

  it('returns null when `p` is not a valid date', () => {
    const token = Buffer.from(
      JSON.stringify({ p: 'nonsense-date', i: ID }),
      'utf8',
    ).toString('base64url');

    expect(decodeCursor(token)).toBeNull();
  });
});
