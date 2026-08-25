import type { SdkHarness } from '../shared/harness';
import { DEFAULT_OUTPUT_PATH } from './constants';
import { renderAndroid } from './index';

export const harness = {
  render: (events) => renderAndroid(events, DEFAULT_OUTPUT_PATH),
  generatedFile: 'test/harness/android/src/main/java/analytics/HtEvents.java',
  toolchain: {
    command: 'sh',
    args: ['test/harness/check-java.sh'],
  },
  test: [
    {
      command: './gradlew',
      args: ['test'],
      cwd: 'test/harness/android',
    },
  ],
} satisfies SdkHarness;
