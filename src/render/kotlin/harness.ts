import type { SdkHarness } from '../shared/harness';
import { DEFAULT_OUTPUT_PATH } from './constants';
import { renderKotlin } from './index';

export const harness = {
  render: (events) => renderKotlin(events, DEFAULT_OUTPUT_PATH),
  generatedFile: 'test/harness/kotlin/src/main/kotlin/analytics/HtEvents.kt',
  toolchain: {
    command: 'sh',
    args: ['test/harness/check-java.sh'],
  },
  test: [
    {
      command: './gradlew',
      args: ['test'],
      cwd: 'test/harness/kotlin',
    },
  ],
} satisfies SdkHarness;
