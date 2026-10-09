import Joi from 'joi';
import { CursorPager } from '../models/cursor-pager';

/**
 * Reusable Joi schema for cursor-based (keyset) pagination query parameters.
 * `limit` is 1..100 (default 20); `cursor` is an optional opaque string.
 */
export const cursorPagerJoiSchema = Joi.object<CursorPager>({
  limit: Joi.number().integer().min(1).max(100).default(20),
  cursor: Joi.string().optional(),
});
