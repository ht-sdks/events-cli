import { collectInitAnswers } from '../src/commands/init/collect';
import { CliError } from '../src/lib/errors';

describe('collectInitAnswers', () => {
  it('uses flags in non-TTY mode', async () => {
    const answers = await collectInitAnswers(
      {
        writeKey: 'key',
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
        if (message.includes('Source write key')) return 'prompted-key';
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
    expect(answers.writeKey).toBe('prompted-key');
    expect(answers.inputType).toBe('git-sync');
    expect(answers.gitSyncPath).toBe('./events');
  });
});
