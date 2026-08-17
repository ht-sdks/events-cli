import {
  assertNoWrapperCollisions,
  pickLatestIndex,
  toPascalCase,
  versionedWrapperName,
  wrapperBase,
} from '../src/normalize/names';
import { CliError } from '../src/lib/errors';

describe('names', () => {
  it('PascalCases labels and guards leading digits', () => {
    expect(toPascalCase('Order Completed')).toBe('OrderCompleted');
    expect(toPascalCase('v2')).toBe('V2');
    expect(toPascalCase('123 start')).toBe('N123Start');
  });

  it('builds wrapper bases and versioned names', () => {
    expect(wrapperBase('track', 'Order Completed')).toBe('trackOrderCompleted');
    expect(wrapperBase('identify', undefined)).toBe('identify');
    expect(versionedWrapperName('track', 'Order Completed', 'v2')).toBe(
      'trackOrderCompletedV2',
    );
  });

  /**
   * Latest policy: prefer version === "default" (last such); else last in order.
   */
  it('picks latest by default-preferring policy', () => {
    expect(pickLatestIndex([{ version: 'v1' }, { version: 'v2' }])).toBe(1);
    expect(
      pickLatestIndex([
        { version: 'v1' },
        { version: 'default' },
        { version: 'v2' },
      ]),
    ).toBe(1);
    expect(
      pickLatestIndex([
        { version: 'default' },
        { version: 'v2' },
        { version: 'default' },
      ]),
    ).toBe(2);
  });

  it('detects wrapper collisions', () => {
    expect(() =>
      assertNoWrapperCollisions([
        { wrapperName: 'trackFooDefault', label: 'a' },
        { wrapperName: 'trackFooDefault', label: 'b' },
      ]),
    ).toThrow(CliError);

    expect(() =>
      assertNoWrapperCollisions([
        { wrapperName: 'trackFooV1', latestAlias: 'trackFoo', label: 'a' },
        { wrapperName: 'trackFoo', label: 'b' },
      ]),
    ).toThrow(/collision/i);
  });
});
