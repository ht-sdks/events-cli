import type { Command } from 'commander';
import { info, result } from '../lib/output';
import { loadConfig, requireTokenIfApi } from './load';
import type { EventsConfig } from './schema';

export type GlobalOpts = {
  config: string;
  token?: string;
  debug?: boolean;
};

export type ResolvedConfig = {
  configPath: string;
  config: EventsConfig;
  /** Present only when input.type === "api". Never printed in full. */
  token?: string;
};

export function resolveFromCommand(command: Command): ResolvedConfig {
  const opts = command.optsWithGlobals() as GlobalOpts;
  const config = loadConfig(opts.config);
  const token = requireTokenIfApi(config, opts.token);
  return { configPath: opts.config, config, token };
}

/** Human-readable summary for stubs / debugging. Never prints the token. */
export function printResolvedSummary(resolved: ResolvedConfig): void {
  const { config, configPath, token } = resolved;
  info(`Loaded config: ${configPath}`);
  result(
    JSON.stringify(
      {
        source: config.source,
        input: config.input,
        outputs: config.outputs,
        token: token ? '(set)' : '(not required)',
      },
      null,
      2,
    ),
  );
}
