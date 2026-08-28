import type { SdkHarness } from '../shared/harness';
import { renderFlutter } from './index';

export const harness = {
  render: renderFlutter,
  generatedFile: 'test/harness/flutter/lib/analytics/generated.dart',
  format: { command: 'dart', args: ['format'], optional: true },
  toolchain: {
    command: 'flutter',
    args: ['--version'],
  },
  test: [
    {
      command: 'flutter',
      args: ['pub', 'get'],
      cwd: 'test/harness/flutter',
    },
    {
      command: 'flutter',
      args: ['test'],
      cwd: 'test/harness/flutter',
    },
  ],
} satisfies SdkHarness;
