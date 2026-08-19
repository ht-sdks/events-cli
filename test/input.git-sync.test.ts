import { join } from 'path';
import { loadFromGitSync } from '../src/input/git-sync/load';
import { CliError } from '../src/lib/errors';
import { COMPONENT_REF_PREFIX } from '../src/input/types';
import { normalize } from '../src/normalize';
import type { ResolvedConfig } from '../src/config/resolve';
import type { EventsConfig } from '../src/config/schema';

const fixtures = join(__dirname, 'fixtures', 'git-sync');

function resolved(eventsDir: string): ResolvedConfig {
  const config: EventsConfig = {
    writeKey: 'my-write-key',
    input: { type: 'git-sync', path: eventsDir },
    outputs: [{ sdk: 'browser-ts', path: './generated.ts' }],
  };
  return {
    configPath: join(eventsDir, 'htevents.config.json'),
    config,
  };
}

describe('loadFromGitSync', () => {
  it('assembles an Event Studio domains tree into a ContractBundle', async () => {
    const bundle = await loadFromGitSync(resolved(join(fixtures, 'studio')));
    expect(bundle.writeKey).toBe('my-write-key');
    expect(bundle.domains).toHaveLength(1);

    const domain = bundle.domains[0];
    expect(domain.name).toBe('Checkout');
    expect(domain.slug).toBe('checkout');
    expect(domain.events?.map((e) => e.slug)).toEqual(
      expect.arrayContaining(['cart-viewed', 'identify']),
    );
    expect(
      domain.events?.find((e) => e.slug === 'identify')?.name,
    ).toBeUndefined();
    expect(domain.eventSources).toEqual([{ id: 'web-app', name: 'web-app' }]);
    expect(domain.components).toHaveLength(2);
    const cart = domain.components?.find((c) => c.slug === 'cart');
    expect(JSON.stringify(cart?.schema)).toContain(
      `${COMPONENT_REF_PREFIX}money`,
    );
    const cartViewed = domain.events?.find((e) => e.slug === 'cart-viewed');
    expect(JSON.stringify(cartViewed?.schema)).toContain(
      `${COMPONENT_REF_PREFIX}cart`,
    );
  });

  it('normalizes git-sync domains the same as the with-refs API fixture', async () => {
    const bundle = await loadFromGitSync(resolved(join(fixtures, 'studio')));
    const wrappers = normalize(bundle).map((e) => e.wrapperName);
    expect(wrappers).toEqual(
      expect.arrayContaining(['trackCartViewedDefault', 'identifyDefault']),
    );
    const cart = normalize(bundle).find(
      (e) => e.wrapperName === 'trackCartViewedDefault',
    );
    expect(
      Object.keys(
        (cart?.schema as { properties?: Record<string, unknown> }).properties ??
          {},
      ),
    ).toEqual(expect.arrayContaining(['amount', 'currency', 'itemCount']));
  });

  it('assembles a legacy contracts tree', async () => {
    const bundle = await loadFromGitSync(resolved(join(fixtures, 'legacy')));
    expect(bundle.domains).toHaveLength(1);
    const domain = bundle.domains[0];
    expect(domain.slug).toBe('commerce');
    expect(domain.events?.[0]?.name).toBe('Order Completed');
    expect(domain.events?.[0]?.slug).toBe('order-completed');
    expect(domain.components).toEqual([]);
  });

  it('rejects mixed contracts and domains layouts', async () => {
    await expect(
      loadFromGitSync(resolved(join(fixtures, 'mixed'))),
    ).rejects.toBeInstanceOf(CliError);
    await expect(
      loadFromGitSync(resolved(join(fixtures, 'mixed'))),
    ).rejects.toThrow(/Ambiguous event contract layout/);
  });

  it('rejects event files without domain metadata', async () => {
    await expect(
      loadFromGitSync(resolved(join(fixtures, 'orphan-event'))),
    ).rejects.toBeInstanceOf(CliError);
    await expect(
      loadFromGitSync(resolved(join(fixtures, 'orphan-event'))),
    ).rejects.toThrow(/No domain metadata file for slug "checkout"/);
  });

  it('rejects invalid YAML with the file path', async () => {
    await expect(
      loadFromGitSync(resolved(join(fixtures, 'invalid-yaml'))),
    ).rejects.toBeInstanceOf(CliError);
    await expect(
      loadFromGitSync(resolved(join(fixtures, 'invalid-yaml'))),
    ).rejects.toThrow(/Invalid YAML in .*domain\.yaml/);
  });

  it('rejects YAML that fails the git-sync schema', async () => {
    await expect(
      loadFromGitSync(resolved(join(fixtures, 'invalid-schema'))),
    ).rejects.toBeInstanceOf(CliError);
    await expect(
      loadFromGitSync(resolved(join(fixtures, 'invalid-schema'))),
    ).rejects.toThrow(/Invalid git-sync file .*domain\.yaml/);
  });

  it('rejects non-git-sync configs', async () => {
    const config: ResolvedConfig = {
      configPath: '/tmp/htevents.config.json',
      config: {
        writeKey: 'wk',
        input: { type: 'api' },
        outputs: [{ sdk: 'browser-ts', path: './generated.ts' }],
      },
    };
    await expect(loadFromGitSync(config)).rejects.toBeInstanceOf(CliError);
  });
});
