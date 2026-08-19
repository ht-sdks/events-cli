import {
  injectableSchemaVersionPath,
  schemaVersionTarget,
} from '../src/render/shared/injection';

describe('schemaVersionTarget', () => {
  it.each([
    {
      name: 'context path on track',
      path: ['context', 'protocols', 'schemaVersion'] as const,
      envelope: 'properties',
      hasData: true,
      expected: 'context',
    },
    {
      name: 'properties path on track',
      path: ['properties', 'apiVersion'] as const,
      envelope: 'properties',
      hasData: true,
      expected: 'data',
    },
    {
      name: 'traits path on identify',
      path: ['traits', 'apiVersion'] as const,
      envelope: 'traits',
      hasData: true,
      expected: 'data',
    },
    {
      name: 'properties path on identify is wrong envelope',
      path: ['properties', 'apiVersion'] as const,
      envelope: 'traits',
      hasData: true,
      expected: 'none',
    },
    {
      name: 'traits path on track is wrong envelope',
      path: ['traits', 'apiVersion'] as const,
      envelope: 'properties',
      hasData: true,
      expected: 'none',
    },
    {
      name: 'context path on alias',
      path: ['context', 'protocols', 'schemaVersion'] as const,
      envelope: 'properties',
      hasData: false,
      expected: 'context',
    },
    {
      name: 'properties path on alias has no data argument',
      path: ['properties', 'apiVersion'] as const,
      envelope: 'properties',
      hasData: false,
      expected: 'none',
    },
  ])('$name', ({ path, envelope, hasData, expected }) => {
    expect(schemaVersionTarget(path, envelope, hasData)).toBe(expected);
  });

  it('returns none for an empty or absent path', () => {
    expect(schemaVersionTarget(undefined, 'properties')).toBe('none');
    expect(schemaVersionTarget([], 'properties')).toBe('none');
  });
});

describe('injectableSchemaVersionPath', () => {
  it('drops alias properties paths and keeps alias context paths', () => {
    expect(
      injectableSchemaVersionPath({
        type: 'alias',
        envelopeKey: 'properties',
        schemaVersionPath: ['properties', 'apiVersion'],
      }),
    ).toBeUndefined();
    expect(
      injectableSchemaVersionPath({
        type: 'alias',
        envelopeKey: 'properties',
        schemaVersionPath: ['context', 'protocols', 'schemaVersion'],
      }),
    ).toEqual(['context', 'protocols', 'schemaVersion']);
  });
});
