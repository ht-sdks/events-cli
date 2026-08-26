import type { NormalizedEvent } from '../../src/normalize/types';
import { JSON_KEY_PROBE_PROPERTIES } from './extra-events';

export { JSON_KEY_PROBE_PROPERTIES } from './extra-events';

/**
 * JVM unit tests still import this helper. The probe event now also lives in
 * shared `extra-events.ts` so every language harness inherits it.
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
