import { CliError } from '../../lib/errors';

export type JvmOutputLayout = {
  packageName: string;
  className: string;
};

const SOURCE_ROOTS = [
  'src/main/java/',
  'src/main/kotlin/',
  'src/test/java/',
  'src/test/kotlin/',
];

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const JAVA_KEYWORDS = new Set([
  'abstract',
  'assert',
  'boolean',
  'break',
  'byte',
  'case',
  'catch',
  'char',
  'class',
  'const',
  'continue',
  'default',
  'do',
  'double',
  'else',
  'enum',
  'extends',
  'final',
  'finally',
  'float',
  'for',
  'goto',
  'if',
  'implements',
  'import',
  'instanceof',
  'int',
  'interface',
  'long',
  'native',
  'new',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'short',
  'static',
  'strictfp',
  'super',
  'switch',
  'synchronized',
  'this',
  'throw',
  'throws',
  'transient',
  'try',
  'void',
  'volatile',
  'while',
  'true',
  'false',
  'null',
  '_',
]);

function posixPath(outputPath: string): string {
  return outputPath.replace(/\\/g, '/').replace(/^\.\//, '');
}

function isValidSegment(name: string): boolean {
  return IDENTIFIER.test(name) && !JAVA_KEYWORDS.has(name);
}

/**
 * Derive `package` + public class from the config-relative output path.
 * `./src/main/java/com/example/events/Generated.java` →
 * `{ packageName: 'com.example.events', className: 'Generated' }`.
 */
export function jvmOutputLayout(outputPath: string): JvmOutputLayout {
  const posix = posixPath(outputPath);
  const slash = posix.lastIndexOf('/');
  const fileName = slash === -1 ? posix : posix.slice(slash + 1);
  let dir = slash === -1 ? '' : posix.slice(0, slash);

  const match = fileName.match(/^(.+)\.(java|kt)$/);
  if (!match) {
    throw new CliError(
      `JVM output path must end in .java or .kt: ${JSON.stringify(outputPath)}.`,
    );
  }
  const className = match[1];
  if (!isValidSegment(className)) {
    throw new CliError(
      `JVM output file "${fileName}" is not a valid public class name.`,
    );
  }

  for (const root of SOURCE_ROOTS) {
    const index = dir.indexOf(root);
    if (index !== -1) {
      dir = dir.slice(index + root.length);
      break;
    }
  }
  dir = dir.replace(/^(java|kotlin)\//, '');

  if (dir.length === 0) {
    throw new CliError(
      `JVM output path must include a package directory: ${JSON.stringify(outputPath)}.`,
    );
  }

  const segments = dir.split('/').filter(Boolean);
  for (const segment of segments) {
    if (!isValidSegment(segment)) {
      throw new CliError(
        `Invalid Java package segment "${segment}" in ${JSON.stringify(outputPath)}.`,
      );
    }
  }

  return { packageName: segments.join('.'), className };
}

export function indentBlock(source: string, spaces: number): string {
  if (source.length === 0) return '';
  const pad = ' '.repeat(spaces);
  return source
    .split('\n')
    .map((line) => (line.length === 0 ? line : `${pad}${line}`))
    .join('\n');
}
