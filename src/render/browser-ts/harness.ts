import type { SdkHarness } from '../shared/harness';
import { renderBrowserTs } from './index';

export const harness = {
  render: renderBrowserTs,
  generatedFile: 'test/harness/browser-ts/generated.ts',
  format: {
    command: 'pnpm',
    args: ['exec', 'prettier', '--write'],
  },
  test: [
    {
      command: 'pnpm',
      args: [
        'exec',
        'tsx',
        '--test',
        'test/harness/browser-ts/wrappers.test.ts',
      ],
      cwd: '.',
    },
  ],
} satisfies SdkHarness;
