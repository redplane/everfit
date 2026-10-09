/**
 * Contract for entities whose identity and creation time never change after
 * they are persisted. Records that are only ever inserted (append-only / log
 * style) implement this interface directly.
 */
export interface IImmutableEntity {
  readonly id: string;
  readonly createdTime: Date;
}
