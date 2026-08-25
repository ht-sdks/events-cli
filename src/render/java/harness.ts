import type { SdkHarness } from '../shared/harness';
import { DEFAULT_OUTPUT_PATH } from './constants';
import { renderJava } from './index';

export const harness = {
  render: (events) => renderJava(events, DEFAULT_OUTPUT_PATH),
  generatedFile: 'test/harness/java/src/main/java/analytics/HtEvents.java',
  toolchain: {
    command: 'sh',
    args: ['test/harness/check-java.sh'],
  },
  test: [
    {
      command: './gradlew',
      args: ['test'],
      cwd: 'test/harness/java',
    },
  ],
} satisfies SdkHarness;
