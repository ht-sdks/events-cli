/**
 * Language-native compile harness. Usage:
 *
 *   pnpm test:harness <sdk>
 *   pnpm test:harness:all
 *
 * Add a `case` here when a new `test/harness/<id>/` lands. Do not add a new
 * package.json script per SDK.
 */
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { emitAndroidHarness } from './emit-android-harness';
import { emitBrowserTsHarness } from './emit-browser-ts-harness';
import { emitGoHarness } from './emit-go-harness';
import { emitKotlinHarness } from './emit-kotlin-harness';
import { emitSwiftHarness } from './emit-swift-harness';

const ROOT = join(__dirname, '..');
const required = process.env.RUN_HARNESS === '1';

const HARNESS_IDS = ['browser-ts', 'go', 'swift', 'android', 'kotlin'] as const;
type HarnessId = (typeof HARNESS_IDS)[number];

function run(
  command: string,
  args: string[],
  cwd: string = ROOT,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    encoding: 'utf-8',
    env,
  });
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

function hasGo(): boolean {
  return (
    spawnSync('go', ['env', 'GOVERSION'], { encoding: 'utf-8' }).status === 0
  );
}

async function runGo(emitOnly: boolean): Promise<number> {
  if (!hasGo()) {
    if (required) {
      console.error('go is required when RUN_HARNESS=1');
      return 1;
    }
    console.error(
      'skipping go harness (go not on PATH; set RUN_HARNESS=1 to require it)',
    );
    return 0;
  }

  await emitGoHarness();
  if (emitOnly) {
    return 0;
  }

  const harness = join(ROOT, 'test', 'harness', 'go');
  const vet = run('go', ['vet', './...'], harness);
  if (vet !== 0) return vet;
  return run('go', ['test', '-count=1', './...'], harness);
}

function hasSwift(): boolean {
  return spawnSync('swift', ['--version'], { encoding: 'utf-8' }).status === 0;
}

async function runSwift(emitOnly: boolean): Promise<number> {
  if (!hasSwift()) {
    if (required) {
      console.error('swift is required when RUN_HARNESS=1');
      return 1;
    }
    console.error(
      'skipping swift harness (swift not on PATH; set RUN_HARNESS=1 to require it)',
    );
    return 0;
  }

  await emitSwiftHarness();
  if (emitOnly) {
    return 0;
  }

  const harness = join(ROOT, 'test', 'harness', 'swift');
  return run('swift', ['test', '--enable-test-discovery'], harness);
}

async function runBrowserTs(emitOnly: boolean): Promise<number> {
  await emitBrowserTsHarness();
  if (emitOnly) {
    return 0;
  }
  return run('pnpm', [
    'exec',
    'tsx',
    '--test',
    'test/harness/browser-ts/wrappers.test.ts',
  ]);
}

function javaMajorFromOutput(text: string): number | undefined {
  const modern = text.match(/version "(\d+)/);
  if (modern === null) {
    return undefined;
  }
  const major = Number(modern[1]);
  if (major === 1) {
    const legacy = text.match(/version "1\.(\d+)/);
    return legacy === null ? undefined : Number(legacy[1]);
  }
  return major;
}

function javaMajorVersion(javaHome?: string): number | undefined {
  const javaBin =
    javaHome === undefined ? 'java' : join(javaHome, 'bin', 'java');
  const result = spawnSync(javaBin, ['-version'], { encoding: 'utf-8' });
  return javaMajorFromOutput(`${result.stderr ?? ''}${result.stdout ?? ''}`);
}

function resolveJdkHome(): string | undefined {
  const envHome = process.env.JAVA_HOME;
  if (envHome !== undefined && (javaMajorVersion(envHome) ?? 0) >= 17) {
    return envHome;
  }
  const studioJbr = join(
    '/Applications',
    'Android Studio.app',
    'Contents',
    'jbr',
    'Contents',
    'Home',
  );
  if (
    existsSync(join(studioJbr, 'bin', 'java')) &&
    (javaMajorVersion(studioJbr) ?? 0) >= 17
  ) {
    return studioJbr;
  }
  if ((javaMajorVersion() ?? 0) >= 17) {
    return envHome ?? '';
  }
  return undefined;
}

function resolveAndroidSdk(): string | undefined {
  const fromEnv = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (fromEnv !== undefined && existsSync(fromEnv)) {
    return fromEnv;
  }
  const macDefault = join(homedir(), 'Library', 'Android', 'sdk');
  if (existsSync(macDefault)) {
    return macDefault;
  }
  return undefined;
}

async function runAndroid(emitOnly: boolean): Promise<number> {
  const harness = join(ROOT, 'test', 'harness', 'android');
  await emitAndroidHarness();
  if (emitOnly) {
    return 0;
  }

  const sdk = resolveAndroidSdk();
  const wrapper = join(
    harness,
    process.platform === 'win32' ? 'gradlew.bat' : 'gradlew',
  );
  const hasWrapper = existsSync(wrapper);
  const hasGradle =
    hasWrapper ||
    spawnSync('gradle', ['--version'], { encoding: 'utf-8' }).status === 0;

  const jdkHome = resolveJdkHome();

  if (sdk === undefined || !hasGradle || jdkHome === undefined) {
    if (required) {
      console.error(
        'Android SDK, Gradle, and JDK 17+ are required when RUN_HARNESS=1',
      );
      return 1;
    }
    console.error(
      'skipping android harness (Android SDK, Gradle, or JDK 17+ not available; set RUN_HARNESS=1 to require it)',
    );
    return 0;
  }

  const env = {
    ...process.env,
    ANDROID_HOME: sdk,
    ANDROID_SDK_ROOT: sdk,
    ...(jdkHome.length > 0 ? { JAVA_HOME: jdkHome } : {}),
  };
  if (hasWrapper) {
    return run(wrapper, ['testDebugUnitTest', '--stacktrace'], harness, env);
  }
  return run('gradle', ['testDebugUnitTest', '--stacktrace'], harness, env);
}

async function runKotlin(emitOnly: boolean): Promise<number> {
  const harness = join(ROOT, 'test', 'harness', 'kotlin');
  await emitKotlinHarness();
  if (emitOnly) {
    return 0;
  }

  const wrapper = join(
    harness,
    process.platform === 'win32' ? 'gradlew.bat' : 'gradlew',
  );
  const hasWrapper = existsSync(wrapper);
  const hasGradle =
    hasWrapper ||
    spawnSync('gradle', ['--version'], { encoding: 'utf-8' }).status === 0;
  const jdkHome = resolveJdkHome();

  if (!hasGradle || jdkHome === undefined) {
    if (required) {
      console.error('Gradle and JDK 17+ are required when RUN_HARNESS=1');
      return 1;
    }
    console.error(
      'skipping kotlin harness (Gradle or JDK 17+ not available; set RUN_HARNESS=1 to require it)',
    );
    return 0;
  }

  const env = {
    ...process.env,
    ...(jdkHome.length > 0 ? { JAVA_HOME: jdkHome } : {}),
  };
  if (hasWrapper) {
    return run(wrapper, ['test', '--stacktrace'], harness, env);
  }
  return run('gradle', ['test', '--stacktrace'], harness, env);
}

async function runHarness(id: HarnessId, emitOnly: boolean): Promise<number> {
  switch (id) {
    case 'go':
      return runGo(emitOnly);
    case 'browser-ts':
      return runBrowserTs(emitOnly);
    case 'swift':
      return runSwift(emitOnly);
    case 'android':
      return runAndroid(emitOnly);
    case 'kotlin':
      return runKotlin(emitOnly);
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}

async function main(): Promise<void> {
  const emitOnly = process.argv.includes('--emit-only');
  const args = process.argv.slice(2).filter((arg) => arg !== '--emit-only');
  const all = args[0] === '--all' || args[0] === 'all';

  if (all) {
    let status = 0;
    for (const id of HARNESS_IDS) {
      const code = await runHarness(id, emitOnly);
      if (code !== 0) status = code;
    }
    process.exit(status);
  }

  const id = args[0];
  if (id === undefined || id.startsWith('-')) {
    console.error(
      'usage: pnpm test:harness <sdk> [--emit-only]\n       pnpm test:harness:all',
    );
    process.exit(1);
  }

  if (!HARNESS_IDS.includes(id as HarnessId)) {
    console.error(`unknown harness: ${id}`);
    process.exit(1);
  }

  process.exit(await runHarness(id as HarnessId, emitOnly));
}

void main();
