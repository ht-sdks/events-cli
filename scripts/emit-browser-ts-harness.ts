/** @deprecated use emit-harness.ts */
export { emitBrowserTsHarness } from './emit-harness';
import { emitBrowserTsHarness } from './emit-harness';

const isDirect =
  process.argv[1] !== undefined &&
  /emit-browser-ts-harness\.(ts|js)$/.test(process.argv[1]);
if (isDirect) {
  void emitBrowserTsHarness();
}
