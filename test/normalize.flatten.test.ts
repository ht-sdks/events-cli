import { flattenComponentRefs } from '../src/normalize/flatten';
import { CliError } from '../src/lib/errors';

describe('flattenComponentRefs', () => {
  const money = {
    slug: 'money',
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string' },
      },
      required: ['amount', 'currency'],
    },
  };

  const cart = {
    slug: 'cart',
    schema: {
      type: 'object',
      allOf: [{ $ref: '#/definitions/components/money' }],
      properties: {
        itemCount: { type: 'number' },
      },
    },
  };

  it('merges allOf component refs as peer properties', () => {
    const schema = {
      type: 'object',
      properties: {
        properties: {
          type: 'object',
          allOf: [{ $ref: '#/definitions/components/cart' }],
        },
      },
    };

    const flattened = flattenComponentRefs(schema, [money, cart]) as {
      properties: {
        properties: {
          properties: Record<string, unknown>;
          required?: string[];
        };
      };
    };

    expect(flattened.properties.properties.properties).toMatchObject({
      amount: { type: 'number' },
      currency: { type: 'string' },
      itemCount: { type: 'number' },
    });
    expect(flattened.properties.properties.required).toEqual(
      expect.arrayContaining(['amount', 'currency']),
    );
    expect(flattened.properties.properties).not.toHaveProperty('allOf');
  });

  it('inlines nested field refs', () => {
    const schema = {
      type: 'object',
      properties: {
        shipTo: { $ref: '#/definitions/components/money' },
      },
    };
    const flattened = flattenComponentRefs(schema, [money]) as {
      properties: { shipTo: { properties: Record<string, unknown> } };
    };
    expect(flattened.properties.shipTo.properties).toMatchObject({
      amount: { type: 'number' },
      currency: { type: 'string' },
    });
  });

  it('replaces dangling nested refs with empty object', () => {
    expect(
      flattenComponentRefs({ $ref: '#/definitions/components/missing' }, []),
    ).toEqual({});
  });

  it('skips dangling allOf refs', () => {
    const flattened = flattenComponentRefs(
      {
        type: 'object',
        allOf: [{ $ref: '#/definitions/components/missing' }],
        properties: { keep: { type: 'string' } },
      },
      [],
    ) as { properties: Record<string, unknown>; allOf?: unknown };
    expect(flattened.properties).toEqual({ keep: { type: 'string' } });
    expect(flattened.allOf).toBeUndefined();
  });

  it('throws on cycles', () => {
    const a = {
      slug: 'a',
      schema: { allOf: [{ $ref: '#/definitions/components/b' }] },
    };
    const b = {
      slug: 'b',
      schema: { allOf: [{ $ref: '#/definitions/components/a' }] },
    };
    expect(() =>
      flattenComponentRefs(
        { allOf: [{ $ref: '#/definitions/components/a' }] },
        [a, b],
      ),
    ).toThrow(CliError);
    expect(() =>
      flattenComponentRefs(
        { allOf: [{ $ref: '#/definitions/components/a' }] },
        [a, b],
      ),
    ).toThrow(/cycle/i);
  });
});
