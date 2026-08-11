import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { ZodError } from 'zod';
import { CliError } from '../lib/errors';
import { configSchema, type EventsConfig } from './schema';

const SECRET_KEYS = ['token', 'apiKey', 'api_key'] as const;

function formatZodError(err: ZodError): string {
  return err.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('\n');
}

function assertNoSecrets(raw: unknown): void {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
  for (const key of SECRET_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      throw new CliError(
        `Config must not contain "${key}". Pass the API token via --token or the HIGHTOUCH_API_TOKEN environment variable.`,
      );
    }
  }
}

export function loadConfig(configPath: string): EventsConfig {
  const absolute = resolve(configPath);
  if (!existsSync(absolute)) {
    throw new CliError(
      `Config file not found: ${absolute}\nRun \`htevents init\` to create one, or pass --config <path>.`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(absolute, 'utf-8'));
  } catch {
    throw new CliError(`Config file is not valid JSON: ${absolute}`);
  }

  assertNoSecrets(raw);

  try {
    return configSchema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new CliError(
        `Invalid config at ${absolute}:\n${formatZodError(err)}`,
      );
    }
    throw err;
  }
}

/** Flag wins over env. Returns undefined when neither is set. */
export function resolveToken(flag?: string): string | undefined {
  const fromFlag = flag?.trim();
  if (fromFlag) return fromFlag;
  const fromEnv = process.env.HIGHTOUCH_API_TOKEN?.trim();
  return fromEnv || undefined;
}

/**
 * For `input.type === "api"`, a token is required.
 * For git-sync, returns undefined (token unused).
 */
export function requireTokenIfApi(
  config: EventsConfig,
  flag?: string,
): string | undefined {
  if (config.input.type !== 'api') return undefined;
  const token = resolveToken(flag);
  if (!token) {
    throw new CliError(
      'API input requires a token. Pass --token or set HIGHTOUCH_API_TOKEN.',
    );
  }
  return token;
}
