import type { SdkHarness } from '../shared/harness';
import { renderNodeTs } from './index';

export const harness = {
  render: renderNodeTs,
  generatedFile: 'test/harness/node-ts/generated.ts',
  format: {
    command: 'pnpm',
    args: ['exec', 'prettier', '--write'],
  },
  test: [
    {
      command: 'pnpm',
      args: ['exec', 'tsx', '--test', 'test/harness/node-ts/wrappers.test.ts'],
      cwd: '.',
    },
  ],
} satisfies SdkHarness;
