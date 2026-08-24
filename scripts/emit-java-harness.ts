/** @deprecated use emit-harness.ts */
export { emitJavaHarness } from './emit-harness';
import { emitJavaHarness } from './emit-harness';

const isDirect =
  process.argv[1] !== undefined &&
  /emit-java-harness\.(ts|js)$/.test(process.argv[1]);
if (isDirect) {
  void emitJavaHarness();
}
