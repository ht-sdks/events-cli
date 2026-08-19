import type { Command } from 'commander';
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

export function resolveConfig(command: Command): ResolvedConfig {
  const opts = command.optsWithGlobals() as GlobalOpts;
  const config = loadConfig(opts.config);
  const token = requireTokenIfApi(config, opts.token);
  return { configPath: opts.config, config, token };
}
