import { Command } from 'commander';
import { buildProgram } from '../src/program';

function helpText(command: Command): string {
  command.configureHelp({ helpWidth: 80 });
  return command.helpInformation();
}

describe('help output', () => {
  it('root help lists all commands and global options', () => {
    expect(helpText(buildProgram())).toMatchSnapshot();
  });

  it.each(['init', 'generate', 'check'])('%s --help', (name) => {
    const sub = buildProgram().commands.find((c) => c.name() === name);
    expect(sub).toBeDefined();
    expect(helpText(sub!)).toMatchSnapshot();
  });
});
