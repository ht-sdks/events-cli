import type { NormalizedEvent } from '../../normalize/types';
import { typeNameFor, renderTypescriptTypes } from '../shared/ts-types';

export { typeNameFor };

function needsPayloadType(event: NormalizedEvent): boolean {
  return event.type !== 'alias';
}

export async function renderTypes(events: NormalizedEvent[]): Promise<string> {
  return renderTypescriptTypes(events.filter(needsPayloadType));
}
