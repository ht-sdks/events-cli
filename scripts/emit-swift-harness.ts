/** @deprecated use emit-harness.ts */
export { emitSwiftHarness } from './emit-harness';
import { emitSwiftHarness } from './emit-harness';

const isDirect =
  process.argv[1] !== undefined &&
  /emit-swift-harness\.(ts|js)$/.test(process.argv[1]);
if (isDirect) {
  void emitSwiftHarness();
}
