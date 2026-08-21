import { z } from 'zod';

export const SUPPORTED_SDKS = ['browser-ts', 'go', 'swift', 'android'] as const;
export type SupportedSdk = (typeof SUPPORTED_SDKS)[number];

const apiInputSchema = z.object({
  type: z.literal('api'),
});

const gitSyncInputSchema = z.object({
  type: z.literal('git-sync'),
  path: z.string().min(1, 'path is required'),
});

export const inputSchema = z.discriminatedUnion('type', [
  apiInputSchema,
  gitSyncInputSchema,
]);

export const outputSchema = z.object({
  sdk: z.enum(SUPPORTED_SDKS),
  path: z.string().min(1, 'path is required'),
});

/**
 * Shape of the committed config file. Secrets (token / apiKey) are
 * intentionally not part of this schema — see loadConfig.
 */
export const configSchema = z
  .object({
    $schema: z.string().optional(),
    source: z.string().min(1, 'source slug is required'),
    input: inputSchema,
    outputs: z.array(outputSchema).min(1, 'at least one output is required'),
  })
  .strict();

export type EventsConfig = z.infer<typeof configSchema>;
