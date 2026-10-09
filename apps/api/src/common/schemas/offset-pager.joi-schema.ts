import Joi from 'joi';
import { OffsetPager } from '../models/offset-pager';

/**
 * Reusable Joi schema for offset-based pagination query parameters.
 * `limit` is 1..100 (default 20); `offset` is >= 0 (default 0).
 */
export const offsetPagerJoiSchema = Joi.object<OffsetPager>({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
});
