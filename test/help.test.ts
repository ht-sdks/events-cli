import { buildProgram } from '../src/program';

describe('help output', () => {
  it('root help lists all commands and global options', () => {
    expect(buildProgram().helpInformation()).toMatchSnapshot();
  });

  it.each(['init', 'generate', 'check'])('%s --help', (name) => {
    const sub = buildProgram().commands.find((c) => c.name() === name);
    expect(sub).toBeDefined();
    expect(sub!.helpInformation()).toMatchSnapshot();
  });
});
