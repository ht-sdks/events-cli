import type { SdkHarness } from '../shared/harness';
import { renderSwift } from './index';

export const harness = {
  render: renderSwift,
  generatedFile: 'test/harness/swift/Sources/Analytics/Generated.swift',
  format: { command: 'swift-format', args: ['-i'], optional: true },
  toolchain: { command: 'swift', args: ['--version'] },
  test: [
    {
      command: 'swift',
      args: ['test', '--enable-test-discovery'],
      cwd: 'test/harness/swift',
    },
  ],
} satisfies SdkHarness;
