import { existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { CliError } from '../lib/errors';
import { configSchema, type EventsConfig } from './schema';

/** Default $schema when the package is installed from npm. */
export const DEFAULT_SCHEMA_REF =
  './node_modules/@ht-sdks/events-cli/schemas/config.schema.json';

export function writeConfigFile(
  configPath: string,
  config: EventsConfig,
  options: { force?: boolean } = {},
): string {
  const absolute = resolve(configPath);
  if (existsSync(absolute) && !options.force) {
    throw new CliError(
      `Config already exists: ${absolute}\nRe-run with --force to overwrite.`,
    );
  }

  const parsed = configSchema.parse(config);
  const body = `${JSON.stringify(parsed, null, 2)}\n`;
  writeFileSync(absolute, body, 'utf-8');
  return absolute;
}

/**
 * Build a config object from init answers. Always sets $schema.
 */
export function buildConfig(input: {
  writeKey: string;
  inputType: 'api' | 'git-sync';
  gitSyncPath?: string;
  sdk: EventsConfig['outputs'][number]['sdk'];
  outputPath: string;
  $schema?: string;
}): EventsConfig {
  const config: EventsConfig = {
    $schema: input.$schema ?? DEFAULT_SCHEMA_REF,
    writeKey: input.writeKey,
    input:
      input.inputType === 'api'
        ? { type: 'api' }
        : { type: 'git-sync', path: input.gitSyncPath ?? '' },
    outputs: [{ sdk: input.sdk, path: input.outputPath }],
  };
  return configSchema.parse(config);
}
