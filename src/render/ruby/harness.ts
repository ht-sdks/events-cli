import type { SdkHarness } from '../shared/harness';
import { renderRuby } from './index';

export const harness = {
  render: renderRuby,
  generatedFile: 'test/harness/ruby/generated.rb',
  toolchain: {
    command: 'sh',
    args: ['test/harness/ruby/check-ruby.sh'],
  },
  test: [
    {
      command: 'bundle',
      args: ['install', '--quiet'],
      cwd: 'test/harness/ruby',
    },
    {
      command: 'bundle',
      args: ['exec', 'ruby', 'test_wrappers.rb'],
      cwd: 'test/harness/ruby',
    },
  ],
} satisfies SdkHarness;
