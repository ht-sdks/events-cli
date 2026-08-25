import type { NormalizedEvent } from '../../src/normalize/types';

/**
 * Four contract spellings of the same logical property. Quicktype legalizes
 * them to distinct Java/Kotlin fields (sometimes prefixed) and `@JsonName`
 * must send each original key.
 */
export const JSON_KEY_PROBE_PROPERTIES = {
  'order-id': { type: 'string' },
  order_id: { type: 'string' },
  OrderId: { type: 'string' },
  orderId: { type: 'string' },
} as const;

/**
 * JVM-only extra contracts. Hyphenated keys are invalid identifiers in
 * PHP/C# type emitters, so they stay out of shared `extra-events.ts`.
 */
export function jvmExtraHarnessEvents(): NormalizedEvent[] {
  return [
    {
      type: 'track',
      name: 'Json Key Probe',
      version: 'default',
      domainName: 'Keys',
      envelopeKey: 'properties',
      schema: {
        type: 'object',
        properties: { ...JSON_KEY_PROBE_PROPERTIES },
      },
      wrapperName: 'trackJsonKeyProbeDefault',
    },
  ];
}
