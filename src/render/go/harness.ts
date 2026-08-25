import type { SdkHarness } from '../shared/harness';
import { renderGo } from './index';

export const harness = {
  render: renderGo,
  generatedFile: 'test/harness/go/analytics/generated.go',
  format: { command: 'gofmt', args: ['-w'], optional: true },
  toolchain: { command: 'go', args: ['env', 'GOVERSION'] },
  test: [
    { command: 'go', args: ['vet', './...'], cwd: 'test/harness/go' },
    {
      command: 'go',
      args: ['test', '-v', '-count=1', './...'],
      cwd: 'test/harness/go',
    },
  ],
} satisfies SdkHarness;
