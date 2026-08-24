/** @deprecated use emit-harness.ts */
export { emitKotlinHarness } from './emit-harness';
import { emitKotlinHarness } from './emit-harness';

const isDirect =
  process.argv[1] !== undefined &&
  /emit-kotlin-harness\.(ts|js)$/.test(process.argv[1]);
if (isDirect) {
  void emitKotlinHarness();
}
