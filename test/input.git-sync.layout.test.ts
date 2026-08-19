import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { CliError } from '../src/lib/errors';
import {
  classifyPath,
  resolveGitSyncLayout,
  resolveGitSyncPath,
} from '../src/input/git-sync/layout';

function workspace(): { dir: string; configPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'htevents-layout-'));
  const configPath = join(dir, 'htevents.config.json');
  writeFileSync(configPath, '{}\n');
  return { dir, configPath };
}

function writeYaml(
  root: string,
  rel: string,
  contents = 'name: Test\n',
): string {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
  return full;
}

describe('resolveGitSyncPath', () => {
  it('resolves relative paths from the config file directory, not cwd', () => {
    const { dir, configPath } = workspace();
    expect(resolveGitSyncPath(configPath, './events')).toBe(
      resolve(dir, 'events'),
    );
  });

  it('keeps absolute paths as-is', () => {
    const { configPath } = workspace();
    const abs = join(tmpdir(), 'git-sync-abs-events');
    expect(resolveGitSyncPath(configPath, abs)).toBe(resolve(abs));
  });
});

describe('resolveGitSyncLayout', () => {
  it('treats path as an events directory when domains/ has YAML', () => {
    const { dir, configPath } = workspace();
    writeYaml(dir, 'events/domains/web/domain.yaml');

    const layout = resolveGitSyncLayout(configPath, './events');
    expect(layout.inputPath).toBe(resolve(dir, 'events'));
    expect(layout.eventsRoot).toBe(resolve(dir, 'events'));
    expect(layout.shape).toBe('domains');
  });

  it('treats path as a git-sync repo root when events/domains has YAML', () => {
    const { dir, configPath } = workspace();
    writeYaml(dir, 'events/domains/web/domain.yaml');

    const layout = resolveGitSyncLayout(configPath, '.');
    expect(layout.inputPath).toBe(resolve(dir));
    expect(layout.eventsRoot).toBe(resolve(dir, 'events'));
    expect(layout.shape).toBe('domains');
  });

  it('detects the legacy contracts layout', () => {
    const { dir, configPath } = workspace();
    writeYaml(dir, 'events/contracts/checkout.yaml');

    const layout = resolveGitSyncLayout(configPath, './events');
    expect(layout.shape).toBe('contracts');
    expect(layout.eventsRoot).toBe(resolve(dir, 'events'));
  });

  it('finds nested YAML (does not require a *.yaml glob at the directory root)', () => {
    const { dir, configPath } = workspace();
    writeYaml(dir, 'events/domains/web/components/cart.yaml');

    const layout = resolveGitSyncLayout(configPath, './events');
    expect(layout.shape).toBe('domains');
  });

  it('resolves ./events from the config directory even when cwd differs', () => {
    const { dir } = workspace();
    const nested = join(dir, 'app');
    mkdirSync(nested);
    const configPath = join(nested, 'htevents.config.json');
    writeFileSync(configPath, '{}\n');
    writeYaml(nested, 'events/domains/web/domain.yaml');

    const layout = resolveGitSyncLayout(configPath, './events');
    expect(layout.eventsRoot).toBe(resolve(nested, 'events'));
    expect(layout.shape).toBe('domains');
  });

  it('rejects mixed contracts and domains layouts', () => {
    const { dir, configPath } = workspace();
    writeYaml(dir, 'events/contracts/checkout.yaml');
    writeYaml(dir, 'events/domains/web/domain.yaml');

    expect(() => resolveGitSyncLayout(configPath, './events')).toThrow(
      CliError,
    );
    expect(() => resolveGitSyncLayout(configPath, './events')).toThrow(
      /Ambiguous event contract layout/,
    );
  });

  it('rejects an empty directory', () => {
    const { dir, configPath } = workspace();
    mkdirSync(join(dir, 'events'));

    expect(() => resolveGitSyncLayout(configPath, './events')).toThrow(
      CliError,
    );
    expect(() => resolveGitSyncLayout(configPath, './events')).toThrow(
      /No event contracts found/,
    );
  });

  it('ignores non-.yaml files when detecting a layout', () => {
    const { dir, configPath } = workspace();
    const codeowners = join(dir, 'events/domains/web/CODEOWNERS');
    mkdirSync(dirname(codeowners), { recursive: true });
    writeFileSync(codeowners, '* @events\n');

    expect(() => resolveGitSyncLayout(configPath, './events')).toThrow(
      /No event contracts found/,
    );
  });

  it('rejects a missing path', () => {
    const { configPath, dir } = workspace();
    expect(() => resolveGitSyncLayout(configPath, './events')).toThrow(
      CliError,
    );
    expect(() => resolveGitSyncLayout(configPath, './events')).toThrow(
      `Git-sync path not found: ${resolve(dir, 'events')}`,
    );
  });

  it('rejects a file that is not a directory', () => {
    const { dir, configPath } = workspace();
    writeFileSync(join(dir, 'events.yaml'), 'name: nope\n');

    expect(() => resolveGitSyncLayout(configPath, './events.yaml')).toThrow(
      CliError,
    );
    expect(() => resolveGitSyncLayout(configPath, './events.yaml')).toThrow(
      /not a directory/,
    );
  });
});

describe('classifyPath', () => {
  const root = '/tmp/events';

  it('classifies the contracts layout', () => {
    expect(
      classifyPath('contracts', root, join(root, 'contracts/checkout.yaml')),
    ).toBe('meta');
    expect(
      classifyPath(
        'contracts',
        root,
        join(root, 'contracts/checkout/order-completed.yaml'),
      ),
    ).toBe('schema');
    expect(
      classifyPath(
        'contracts',
        root,
        join(root, 'contracts/checkout/nested/too-deep.yaml'),
      ),
    ).toBe('other');
  });

  it('classifies the domains layout', () => {
    expect(
      classifyPath('domains', root, join(root, 'domains/web/domain.yaml')),
    ).toBe('meta');
    expect(
      classifyPath('domains', root, join(root, 'domains/web/cart-viewed.yaml')),
    ).toBe('schema');
    expect(
      classifyPath(
        'domains',
        root,
        join(root, 'domains/web/components/cart.yaml'),
      ),
    ).toBe('component');
    expect(
      classifyPath('domains', root, join(root, 'domains/web/CODEOWNERS')),
    ).toBe('other');
    expect(
      classifyPath('domains', root, join(root, 'contracts/checkout.yaml')),
    ).toBe('other');
  });
});
