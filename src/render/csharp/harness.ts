import type { SdkHarness } from '../shared/harness';
import { renderCSharp } from './index';

export const harness = {
  render: renderCSharp,
  generatedFile: 'test/harness/csharp/Analytics/HtEvents.cs',
  toolchain: {
    command: 'sh',
    args: ['test/harness/csharp/check-dotnet.sh'],
  },
  test: [
    {
      command: 'dotnet',
      args: ['test', '--nologo'],
      cwd: 'test/harness/csharp',
    },
  ],
} satisfies SdkHarness;
