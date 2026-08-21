import {
  collectInitAnswers,
  defaultOutputPath,
} from '../src/commands/init/collect';
import { SUPPORTED_SDKS, type SupportedSdk } from '../src/config/schema';
import { CliError } from '../src/lib/errors';

const DEFAULT_OUTPUT_PATHS = {
  'browser-ts': './src/analytics/generated.ts',
  go: './analytics/generated.go',
  swift: './Sources/Analytics/Generated.swift',
  android: './src/main/java/analytics/HtEvents.java',
  kotlin: './src/main/kotlin/analytics/HtEvents.kt',
} as const satisfies Record<SupportedSdk, string>;

describe('collectInitAnswers', () => {
  it('uses flags in non-TTY mode', async () => {
    const answers = await collectInitAnswers(
      {
        source: 'key',
        input: 'api',
        output: './out.ts',
        sdk: 'browser-ts',
      },
      undefined,
      false,
    );
    expect(answers.inputType).toBe('api');
  });

  it('errors in non-TTY when flags are missing', async () => {
    await expect(collectInitAnswers({}, undefined, false)).rejects.toThrow(
      CliError,
    );
  });

  it('prompts for missing fields when TTY', async () => {
    const prompter = {
      input: jest.fn(async ({ message }: { message: string }) => {
        if (message.includes('Event source slug')) return 'prompted-key';
        if (message.includes('Output')) return './gen.ts';
        if (message.includes('git-sync')) return './events';
        return '';
      }),
      select: jest.fn(async ({ message }: { message: string }) => {
        if (message.includes('Contract')) return 'git-sync';
        return 'browser-ts';
      }),
      confirm: jest.fn(),
    };
    const answers = await collectInitAnswers({}, prompter as never, true);
    expect(answers.source).toBe('prompted-key');
    expect(answers.inputType).toBe('git-sync');
    expect(answers.gitSyncPath).toBe('./events');
  });

  it.each(SUPPORTED_SDKS)(
    'defaults output path for %s when prompting',
    async (sdk) => {
      const prompter = {
        input: jest.fn(
          async ({
            message,
            default: fallback,
          }: {
            message: string;
            default?: string;
          }) => {
            if (message.includes('Source write key')) return 'key';
            if (message.includes('Output')) return fallback ?? '';
            return '';
          },
        ),
        select: jest.fn(async ({ message }: { message: string }) => {
          if (message.includes('Contract')) return 'api';
          return sdk;
        }),
        confirm: jest.fn(),
      };
      const answers = await collectInitAnswers({}, prompter as never, true);
      expect(answers.sdk).toBe(sdk);
      expect(answers.outputPath).toBe(DEFAULT_OUTPUT_PATHS[sdk]);
      expect(defaultOutputPath(sdk)).toBe(DEFAULT_OUTPUT_PATHS[sdk]);
    },
  );
});
