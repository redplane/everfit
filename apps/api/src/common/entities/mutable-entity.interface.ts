import { IImmutableEntity } from './immutable-entity.interface';

/**
 * Contract for entities that can be updated after creation. Extends
 * {@link IImmutableEntity} with an optional, read/write `updatedTime` that is
 * stamped whenever the record changes.
 */
export interface IMutableEntity extends IImmutableEntity {
  get updatedTime(): Date | undefined;
  set updatedTime(value: Date | undefined);
}
