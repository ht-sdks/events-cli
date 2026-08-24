import type { SdkHarness } from '../shared/harness';
import { renderPhp } from './index';

export const harness = {
  render: renderPhp,
  generatedFile: 'test/harness/php/generated.php',
  toolchain: {
    command: 'sh',
    args: ['test/harness/php/check-php.sh'],
  },
  test: [
    {
      command: 'composer',
      args: ['install', '--no-interaction', '--quiet'],
      cwd: 'test/harness/php',
    },
    {
      command: 'php',
      args: ['test_wrappers.php'],
      cwd: 'test/harness/php',
    },
  ],
} satisfies SdkHarness;
