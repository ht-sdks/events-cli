import type { SdkHarness } from '../shared/harness';
import { renderReactNative } from './index';

export const harness = {
  render: renderReactNative,
  generatedFile: 'test/harness/react-native/generated.ts',
  format: {
    command: 'pnpm',
    args: ['exec', 'prettier', '--write'],
  },
  test: [
    {
      command: 'npm',
      args: [
        'ci',
        '--no-fund',
        '--no-audit',
        '--legacy-peer-deps',
        '--ignore-scripts',
      ],
      cwd: 'test/harness/react-native',
    },
    {
      command: 'npx',
      args: ['tsc', '--noEmit'],
      cwd: 'test/harness/react-native',
    },
    {
      command: 'npx',
      args: ['tsx', '--test', 'wrappers.test.ts'],
      cwd: 'test/harness/react-native',
    },
  ],
} satisfies SdkHarness;
