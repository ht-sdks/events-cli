import type { NormalizedEvent } from '../../normalize/types';

/** Declared in `src/render/<sdk-id>/harness.ts` and discovered by the scripts. */
export type SdkHarness = {
  /** Produce generated source for the shared fixture events. */
  render: (events: NormalizedEvent[]) => Promise<string>;
  /** Repo-relative path of the gitignored generated file. */
  generatedFile: string;
  /**
   * Run as `command ...args generatedFile` after writing.
   * If `optional` and the binary is missing, keep the unformatted file.
   */
  format?: {
    command: string;
    args: string[];
    optional?: boolean;
  };
  /**
   * If this command fails, skip the harness locally unless RUN_HARNESS=1.
   * Omit when the Node toolchain is enough (browser-ts).
   */
  toolchain?: { command: string; args: string[] };
  /** Language-native tests, cwd relative to the repo root. */
  test: { command: string; args: string[]; cwd: string }[];
};
