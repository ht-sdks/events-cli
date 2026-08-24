import type { NormalizedEvent } from '../../normalize/types';
import { renderNestedKotlinTypes } from '../shared/kotlin-types';
import { typeNameFor } from './names';

export { typeNameFor };

export async function renderTypes(
  events: NormalizedEvent[],
  packageName: string,
): Promise<{ imports: string[]; body: string }> {
  return renderNestedKotlinTypes(events, typeNameFor, packageName);
}
