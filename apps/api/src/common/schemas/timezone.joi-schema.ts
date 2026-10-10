import Joi from 'joi';

/**
 * Returns whether `zone` is a real IANA timezone name, by asking the platform `Intl` (ICU) to
 * construct a formatter for it. `Intl.DateTimeFormat` throws a `RangeError` for an unknown zone — this
 * is a boundary adapter around a throwing platform API (not control-flow), so the `try/catch` is the
 * idiomatic probe. The accepted set is therefore the runtime's full IANA database rather than a
 * hardcoded list.
 */
function isValidIanaTimeZone(zone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Reusable Joi schema validating an IANA timezone name (e.g. `'Asia/Ho_Chi_Minh'`, `'UTC'`). Used by
 * the PR comparison read (F8) to derive period boundaries in the caller's zone. A missing value, a
 * non-string, or an unknown zone fails here as a 400 `ValidationException` before the service runs.
 * Callers apply `.required()` at the composition site.
 */
export const timezoneJoiSchema = Joi.string().custom((value: string, helpers) => {
  if (!isValidIanaTimeZone(value)) {
    return helpers.error('any.invalid');
  }

  return value;
}, 'IANA timezone');
