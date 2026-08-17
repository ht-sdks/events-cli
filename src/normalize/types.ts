import type { EventType, JsonSchema } from '../input/types';

export type EnvelopeKey = 'properties' | 'traits';

export type NormalizedEvent = {
  type: EventType;
  name?: string;
  version: string;
  domainName: string;
  domainSlug?: string;
  schemaVersionPath?: string[];
  /** `properties` for track/page/screen/alias; `traits` for identify/group. */
  envelopeKey: EnvelopeKey;
  /**
   * Self-contained business schema (envelope unwrapped, component `$ref`s flattened).
   * Safe to pass to quicktype.
   */
  schema: JsonSchema;
  /** Version-suffixed wrapper, e.g. `trackOrderCompletedV2`. */
  wrapperName: string;
  /** Unsuffixed alias on the latest version only, e.g. `trackOrderCompleted`. */
  latestAlias?: string;
};
