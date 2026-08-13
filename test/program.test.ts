import { readFileSync } from 'fs';
import { join } from 'path';
import { buildProgram } from '../src/program';

describe('program', () => {
  it('has the expected name', () => {
    expect(buildProgram().name()).toBe('htevents');
  });
  it('reports the version from package.json', () => {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
    );
    expect(buildProgram().version()).toBe(pkg.version);
  });
});
