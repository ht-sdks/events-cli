import { CliError } from '../lib/errors';
import type { EventType, JsonSchema } from '../input/types';
import type { EnvelopeKey } from './types';

export const envelopeKeyForType: Record<EventType, EnvelopeKey> = {
  track: 'properties',
  page: 'properties',
  screen: 'properties',
  identify: 'traits',
  group: 'traits',
};

/**
 * Peel the Segment-style envelope (`properties` / `traits`) from a stored event schema.
 * Port of app `unwrapTopLevelSchema` in transformation.tsx.
 */
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
