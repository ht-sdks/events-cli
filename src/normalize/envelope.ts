/**
 * Peel the Segment-style envelope (`properties` / `traits`) from a stored event schema.
 *
 * ## Port of Hightouch app editor unwrap
 *
 * Source of truth (diff against this file when those helpers change):
 *   repo: hightouchio/hightouch
 *   file: packages/app/src/events/contracts/contract/event-schema/transformation.tsx
 *
 * ### Ported (keep in sync — same mapping and unwrap)
 *   `editableProperties` → `envelopeKeyForType`
 *     identify/group → `"traits"`; track/page/screen/alias → `"properties"`
 *   `unwrapTopLevelSchema` → `unwrapEnvelope`
 *     app: `return schema.properties[editableProperties[eventType]]`
 *
 * ### Intentionally not ported
 *   `wrapInTopLevelSchema` (visual-editor round-trip, including `context`)
 *
 * ### CLI adaptations (do not copy app changes here blindly)
 *   Throws `CliError` if top-level `"properties"` or the envelope key is missing.
 *     App assumes both exist (`schema.properties[property]`).
 *   No AJV `SomeJSONSchema` typing.
 */

import { CliError } from '../lib/errors';
import type { EventType, JsonSchema } from '../input/types';
import type { EnvelopeKey } from './types';

export const envelopeKeyForType: Record<EventType, EnvelopeKey> = {
  track: 'properties',
  page: 'properties',
  screen: 'properties',
  identify: 'traits',
  group: 'traits',
  alias: 'properties',
};

export function unwrapEnvelope(
  schema: JsonSchema,
  eventType: EventType,
): JsonSchema {
  const envelopeKey = envelopeKeyForType[eventType];
  const top = schema as Record<string, unknown>;
  const properties = top.properties;
  if (
    properties === null ||
    typeof properties !== 'object' ||
    Array.isArray(properties)
  ) {
    throw new CliError(
      `Cannot unwrap ${eventType} schema: missing top-level "properties" object.`,
    );
  }

  const inner = (properties as Record<string, unknown>)[envelopeKey];
  if (inner === null || typeof inner !== 'object' || Array.isArray(inner)) {
    throw new CliError(
      `Cannot unwrap ${eventType} schema: missing "${envelopeKey}" envelope.`,
    );
  }

  return inner as JsonSchema;
}
