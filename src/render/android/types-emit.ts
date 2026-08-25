import type { NormalizedEvent } from '../../normalize/types';
import { renderNestedJavaTypes } from '../shared/java-types';
import { typeNameFor } from './names';

export { typeNameFor };

export async function renderTypes(
  events: NormalizedEvent[],
  packageName: string,
): Promise<{
  imports: string[];
  body: string;
}> {
  return renderNestedJavaTypes(events, typeNameFor, packageName);
}
