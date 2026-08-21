import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildConfig, writeConfigFile } from '../src/config/write';
import { loadConfig } from '../src/config/load';
import { CliError } from '../src/lib/errors';

describe('writeConfigFile', () => {
  it('writes a loadable config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'htevents-'));
    const path = join(dir, 'htevents.config.json');
    const config = buildConfig({
      source: 'key',
      inputType: 'git-sync',
      gitSyncPath: './events',
      sdk: 'browser-ts',
      outputPath: './out.ts',
    });
    writeConfigFile(path, config);
    expect(loadConfig(path).source).toBe('key');
    expect(JSON.parse(readFileSync(path, 'utf-8')).$schema).toContain(
      'schemas/config.schema.json',
    );
  });

  it('refuses to overwrite without force', () => {
    const dir = mkdtempSync(join(tmpdir(), 'htevents-'));
    const path = join(dir, 'htevents.config.json');
    writeFileSync(path, '{}');
    const config = buildConfig({
      source: 'key',
      inputType: 'api',
      sdk: 'browser-ts',
      outputPath: './out.ts',
    });
    expect(() => writeConfigFile(path, config)).toThrow(CliError);
    writeConfigFile(path, config, { force: true });
  });
});
