import { z } from 'zod';
import { CliError } from '../lib/errors';
import type { ResolvedConfig } from '../config/resolve';
import { parseDomain } from './parse';
import type { ContractBundle, Domain } from './types';

export const DEFAULT_API_BASE_URL = 'https://api.hightouch.com/api/v1';
/** Match backend; HTTP header names are case-insensitive. */
export const EVENT_SOURCE_WRITE_KEY_HEADER =
  'X-Hightouch-Event-Source-Write-Key';

const DEFAULT_PAGE_SIZE = 100;

const listResponseSchema = z.object({
  data: z.array(z.unknown()),
  hasMore: z.boolean(),
});

function resolveBaseUrl(): string {
  const raw =
    process.env.HIGHTOUCH_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
  return raw.replace(/\/+$/, '');
}

async function fetchPage(
  url: URL,
  token: string,
  writeKey: string,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        [EVENT_SOURCE_WRITE_KEY_HEADER]: writeKey,
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new CliError(
      `Failed to reach Hightouch API at ${url.origin}: ${detail}`,
    );
  }

  if (response.status === 401) {
    throw new CliError(
      'Authentication failed (401). Check --token / HIGHTOUCH_API_TOKEN.',
    );
  }
  if (response.status === 404) {
    throw new CliError(
      'Event domains API returned 404. Event Studio may be disabled for this workspace, or the API base URL is wrong.',
    );
  }
  if (!response.ok) {
    throw new CliError(
      `Hightouch API error ${response.status} ${response.statusText} for GET ${url.pathname}.`,
    );
  }
  return response;
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return text.length ? JSON.parse(text) : {};
  } catch {
    throw new CliError('Hightouch API returned a non-JSON response body.');
  }
}

export async function loadFromApi(
  resolved: ResolvedConfig,
): Promise<ContractBundle> {
  const token = resolved.token?.trim();
  if (!token) {
    throw new CliError(
      'API input requires a token. Pass --token or set HIGHTOUCH_API_TOKEN.',
    );
  }

  const writeKey = resolved.config.writeKey.trim();
  if (!writeKey) {
    throw new CliError(
      'Config "source" (event source write key) must not be empty.',
    );
  }

  if (typeof fetch !== 'function') {
    throw new CliError('fetch is not available in this runtime.');
  }

  const baseUrl = resolveBaseUrl();
  const domains: Domain[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(`${baseUrl}/events/domains`);
    url.searchParams.set('limit', String(DEFAULT_PAGE_SIZE));
    url.searchParams.set('offset', String(offset));

    const response = await fetchPage(url, token, writeKey);
    const body = await readJsonBody(response);
    const parsed = listResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new CliError(
        `Malformed response from ${url.pathname}: expected { data, hasMore }.`,
      );
    }

    for (const item of parsed.data.data) {
      domains.push(parseDomain(item));
    }

    hasMore = parsed.data.hasMore;
    offset += DEFAULT_PAGE_SIZE;
  }

  return { writeKey: writeKey, domains };
}
