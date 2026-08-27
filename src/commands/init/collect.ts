import { CliError } from '../../lib/errors';
import { SUPPORTED_SDKS, type SupportedSdk } from '../../config/schema';
import { loadPrompter, Prompter } from './prompter';

export type InitFlags = {
  source?: string;
  input?: 'api' | 'git-sync';
  gitSyncPath?: string;
  sdk?: SupportedSdk;
  output?: string;
  force?: boolean;
};

export type InitAnswers = {
  source: string;
  inputType: 'api' | 'git-sync';
  gitSyncPath?: string;
  sdk: SupportedSdk;
  outputPath: string;
  force: boolean;
};

export function defaultOutputPath(sdk: SupportedSdk): string {
  switch (sdk) {
    case 'browser-ts':
      return './src/analytics/generated.ts';
    case 'node-ts':
      return './src/analytics/generated.ts';
    case 'python':
      return './analytics/generated.py';
    case 'ruby':
      return './analytics/generated.rb';
    case 'php':
      return './src/Hightouch/Generated/';
    case 'csharp':
      return './Analytics/HtEvents.cs';
    case 'go':
      return './analytics/generated.go';
    case 'swift':
      return './Sources/Analytics/Generated.swift';
    case 'android':
      return './src/main/java/analytics/HtEvents.java';
    case 'kotlin':
      return './src/main/kotlin/analytics/HtEvents.kt';
    case 'java':
      return './analytics/HtEvents.java';
    case 'react-native':
      return './src/analytics/react-native/generated.ts';
    case 'flutter':
      return './lib/analytics/generated.dart';
    default: {
      const exhaustive: never = sdk;
      return exhaustive;
    }
  }
}

function fromFlags(flags: InitFlags): InitAnswers {
  if (!flags.source || !flags.input || !flags.sdk || !flags.output) {
    throw new CliError(
      'Non-interactive init requires --source, --input, --sdk, and --output' +
        (flags.input === 'git-sync' ? ', plus --git-sync-path' : '') +
        '.',
    );
  }
  if (flags.input === 'git-sync' && !flags.gitSyncPath) {
    throw new CliError('`--input git-sync` requires --git-sync-path.');
  }
  return {
    source: flags.source,
    inputType: flags.input,
    gitSyncPath: flags.gitSyncPath,
    sdk: flags.sdk,
    outputPath: flags.output,
    force: Boolean(flags.force),
  };
}

export async function collectInitAnswers(
  flags: InitFlags,
  prompter?: Prompter,
  isTTY: boolean = Boolean(process.stdin.isTTY),
): Promise<InitAnswers> {
  if (!isTTY) {
    return fromFlags(flags);
  }

  const p = prompter ?? (await loadPrompter());

  const source =
    flags.source ??
    (await p.input({
      message: 'Event source slug (copy from the source Setup tab)',
      validate: (v) => (v.trim() ? true : 'Required'),
    }));

  const inputType =
    flags.input ??
    ((await p.select({
      message: 'Contract input',
      choices: [
        { name: 'API (fetch from Hightouch)', value: 'api' as const },
        { name: 'Git-sync (local directory)', value: 'git-sync' as const },
      ],
    })) as 'api' | 'git-sync');

  let gitSyncPath = flags.gitSyncPath;
  if (inputType === 'git-sync') {
    gitSyncPath =
      gitSyncPath ??
      (await p.input({
        message: 'Path to git-sync events directory',
        default: './events',
        validate: (v) => (v.trim() ? true : 'Required'),
      }));
  }

  const sdk =
    flags.sdk ??
    ((await p.select({
      message: 'SDK to generate for',
      choices: SUPPORTED_SDKS.map((value) => ({ name: value, value })),
    })) as SupportedSdk);

  const outputPath =
    flags.output ??
    (await p.input({
      message: 'Output path for generated code',
      default: defaultOutputPath(sdk),
      validate: (v) => (v.trim() ? true : 'Required'),
    }));

  const force =
    flags.force ??
    false; /* overwrite is handled later via exists check + --force / confirm */

  return {
    source: source.trim(),
    inputType,
    gitSyncPath: gitSyncPath?.trim(),
    sdk,
    outputPath: outputPath.trim(),
    force,
  };
}
