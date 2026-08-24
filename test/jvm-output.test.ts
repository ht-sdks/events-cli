import { jvmOutputLayout } from '../src/render/shared/jvm-output';
import { CliError } from '../src/lib/errors';

describe('jvmOutputLayout', () => {
  it('maps a Maven java path to package and class', () => {
    expect(
      jvmOutputLayout('./src/main/java/com/example/events/Generated.java'),
    ).toEqual({ packageName: 'com.example.events', className: 'Generated' });
  });

  it('maps a Maven kotlin path to package and class', () => {
    expect(jvmOutputLayout('./src/main/kotlin/com/foo/Bar.kt')).toEqual({
      packageName: 'com.foo',
      className: 'Bar',
    });
  });

  it('uses the parent directory when there is no source root', () => {
    expect(jvmOutputLayout('./analytics/HtEvents.java')).toEqual({
      packageName: 'analytics',
      className: 'HtEvents',
    });
  });

  it('rejects a missing package directory', () => {
    expect(() => jvmOutputLayout('./HtEvents.java')).toThrow(CliError);
  });

  it('rejects a non-java/kotlin extension', () => {
    expect(() => jvmOutputLayout('./analytics/HtEvents.txt')).toThrow(CliError);
  });

  it('rejects an invalid class name', () => {
    expect(() => jvmOutputLayout('./analytics/1Events.java')).toThrow(CliError);
  });
});
