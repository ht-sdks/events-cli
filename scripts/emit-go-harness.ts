/** @deprecated use emit-harness.ts */
export { emitGoHarness } from './emit-harness';
import { emitGoHarness } from './emit-harness';

const isDirect =
  process.argv[1] !== undefined &&
  /emit-go-harness\.(ts|js)$/.test(process.argv[1]);
if (isDirect) {
  void emitGoHarness();
}
