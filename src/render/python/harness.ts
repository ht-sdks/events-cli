import type { SdkHarness } from '../shared/harness';
import { renderPython } from './index';

export const harness = {
  render: renderPython,
  generatedFile: 'test/harness/python/generated.py',
  toolchain: {
    command: 'sh',
    args: ['test/harness/python/check-python.sh'],
  },
  test: [
    {
      command: 'python3',
      args: ['-m', 'pip', 'install', '-r', 'requirements.txt', '-q'],
      cwd: 'test/harness/python',
    },
    {
      command: 'python3',
      args: ['-m', 'unittest', 'test_wrappers', '-v'],
      cwd: 'test/harness/python',
    },
  ],
} satisfies SdkHarness;
