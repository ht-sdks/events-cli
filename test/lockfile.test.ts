import { hashSchema, buildLockfile, serializeLockfile } from '../src/lockfile';
import { eventsFromFixture } from './helpers/fixtures';

describe('lockfile', () => {
  it('hashes schemas independently of key order', () => {
    expect(hashSchema({ b: 1, a: { z: 2, y: 3 } })).toBe(
      hashSchema({ a: { y: 3, z: 2 }, b: 1 }),
    );
  });

  it('matches a stable snapshot for fixture events', () => {
    const events = eventsFromFixture('simple-track.json');
    const lockfile = buildLockfile('wk', events);
    expect(lockfile).toMatchSnapshot();
    expect(serializeLockfile(lockfile)).toBe(
      `${JSON.stringify(lockfile, null, 2)}\n`,
    );
  });

  it('is byte-identical for the same events', () => {
    const events = eventsFromFixture('with-refs.json');
    const a = serializeLockfile(buildLockfile('wk', events));
    const b = serializeLockfile(buildLockfile('wk', events));
    expect(a).toBe(b);
  });

  it('changes only the mutated event hash when a schema field changes', () => {
    const events = eventsFromFixture('multi-version.json');
    const before = buildLockfile('wk', events);
    const mutated = events.map((event) =>
      event.wrapperName === 'trackOrderCompletedV1'
        ? {
            ...event,
            schema: {
              ...event.schema,
              properties: {
                ...(event.schema.properties as Record<string, unknown>),
                extra: { type: 'string' },
              },
            },
          }
        : event,
    );
    const after = buildLockfile('wk', mutated);

    expect(after.events).toHaveLength(before.events.length);
    const v1Before = before.events.find(
      (e) => e.wrapperName === 'trackOrderCompletedV1',
    );
    const v1After = after.events.find(
      (e) => e.wrapperName === 'trackOrderCompletedV1',
    );
    const v2Before = before.events.find(
      (e) => e.wrapperName === 'trackOrderCompletedV2',
    );
    const v2After = after.events.find(
      (e) => e.wrapperName === 'trackOrderCompletedV2',
    );
    expect(v1After?.schemaHash).not.toBe(v1Before?.schemaHash);
    expect(v2After?.schemaHash).toBe(v2Before?.schemaHash);
  });
});
