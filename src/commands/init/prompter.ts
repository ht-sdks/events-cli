export type Prompter = {
  input: (opts: {
    message: string;
    default?: string;
    validate?: (value: string) => true | string;
  }) => Promise<string>;
  select: <T>(opts: {
    message: string;
    choices: Array<{ name: string; value: T }>;
  }) => Promise<T>;
  confirm: (opts: { message: string; default?: boolean }) => Promise<boolean>;
};

export async function loadPrompter(): Promise<Prompter> {
  const mod = await import('@inquirer/prompts');
  return {
    input: mod.input,
    select: mod.select,
    confirm: mod.confirm,
  };
}
