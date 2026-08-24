/** @deprecated use emit-harness.ts */
export { emitAndroidHarness } from './emit-harness';
import { emitAndroidHarness } from './emit-harness';

const isDirect =
  process.argv[1] !== undefined &&
  /emit-android-harness\.(ts|js)$/.test(process.argv[1]);
if (isDirect) {
  void emitAndroidHarness();
}
