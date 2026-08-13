import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DEFAULT_API_BASE_URL,
  EVENT_SOURCE_WRITE_KEY_HEADER,
  loadFromApi,
} from '../src/input/api';
import { loadConfig } from '../src/config/load';
import { CliError } from '../src/lib/errors';
import type { ResolvedConfig } from '../src/config/resolve';

const configFixtures = join(__dirname, 'fixtures', 'config');
const domainFixtures = join(__dirname, 'fixtures', 'domains');

function resolved(token = 'tok'): ResolvedConfig {
  const configPath = join(configFixtures, 'valid-api.json');
  return {
    configPath,
    config: loadConfig(configPath),
    token,
  };
}

function simpleDomain(): unknown {
  return JSON.parse(
    readFileSync(join(domainFixtures, 'simple-track.json'), 'utf-8'),
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain' },
  });
}

describe('loadFromApi', () => {
  const originalBaseUrl = process.env.HIGHTOUCH_API_BASE_URL;
  let fetchSpy: jest.SpyInstance;

  afterEach(() => {
    fetchSpy?.mockRestore();
    if (originalBaseUrl === undefined) {
      delete process.env.HIGHTOUCH_API_BASE_URL;
    } else {
      process.env.HIGHTOUCH_API_BASE_URL = originalBaseUrl;
    }
  });

  function mockFetch(impl: typeof fetch): void {
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(impl);
  }

  it('paginates and sends Authorization + write-key header', async () => {
    const calls: Array<{ url: string; headers: Headers }> = [];
    mockFetch(async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      calls.push({ url, headers });

      if (url.includes('offset=0')) {
        return jsonResponse(200, {
          data: [{ name: 'A', events: [] }],
          hasMore: true,
        });
      }
      return jsonResponse(200, {
        data: [{ name: 'B', events: [] }],
        hasMore: false,
      });
    });

    const bundle = await loadFromApi(resolved());

    expect(bundle.writeKey).toBe('my-write-key');
    expect(bundle.domains.map((d) => d.name)).toEqual(['A', 'B']);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain('offset=0');
    expect(calls[0].url).toContain('limit=100');
    expect(calls[1].url).toContain('offset=100');

    for (const call of calls) {
      expect(call.headers.get('Authorization')).toBe('Bearer tok');
      expect(call.headers.get(EVENT_SOURCE_WRITE_KEY_HEADER)).toBe(
        'my-write-key',
      );
      expect(call.url).not.toMatch(/write-key=/i);
    }
  });

  it('returns empty domains for an empty page', async () => {
    mockFetch(async () => jsonResponse(200, { data: [], hasMore: false }));

    const bundle = await loadFromApi(resolved());
    expect(bundle).toEqual({ writeKey: 'my-write-key', domains: [] });
  });

  it('parses a real domain fixture from the list response', async () => {
    mockFetch(async () =>
      jsonResponse(200, { data: [simpleDomain()], hasMore: false }),
    );

    const bundle = await loadFromApi(resolved());
    expect(bundle.domains).toHaveLength(1);
    expect(bundle.domains[0].slug).toBe('commerce');
    expect(bundle.domains[0].events?.[0]?.name).toBe('Order Completed');
  });

  it('uses HIGHTOUCH_API_BASE_URL when set', async () => {
    process.env.HIGHTOUCH_API_BASE_URL = 'https://env.example/api/v1';
    const urls: string[] = [];
    mockFetch(async (input) => {
      urls.push(String(input));
      return jsonResponse(200, { data: [], hasMore: false });
    });

    await loadFromApi(resolved());

    expect(urls[0]).toMatch(
      /^https:\/\/env\.example\/api\/v1\/events\/domains\?/,
    );
  });

  it('defaults to production API base URL', async () => {
    delete process.env.HIGHTOUCH_API_BASE_URL;
    const urls: string[] = [];
    mockFetch(async (input) => {
      urls.push(String(input));
      return jsonResponse(200, { data: [], hasMore: false });
    });

    await loadFromApi(resolved());

    expect(urls[0].startsWith(`${DEFAULT_API_BASE_URL}/events/domains?`)).toBe(
      true,
    );
  });

  it('throws CliError on 401', async () => {
    mockFetch(async () => jsonResponse(401, { message: 'unauthorized' }));

    await expect(loadFromApi(resolved())).rejects.toThrow(
      /401|Authentication/i,
    );
    await expect(loadFromApi(resolved())).rejects.toBeInstanceOf(CliError);
  });

  it('throws CliError on 404', async () => {
    mockFetch(async () => jsonResponse(404, { message: 'not found' }));

    await expect(loadFromApi(resolved())).rejects.toThrow(/404|Event Studio/i);
  });

  it('throws CliError on other non-OK status', async () => {
    mockFetch(
      async () =>
        new Response('nope', {
          status: 500,
          statusText: 'Internal Server Error',
        }),
    );

    await expect(loadFromApi(resolved())).rejects.toThrow(
      /500|Internal Server Error/i,
    );
  });

  it('throws CliError on non-JSON body', async () => {
    mockFetch(async () => textResponse(200, 'not-json'));

    await expect(loadFromApi(resolved())).rejects.toThrow(/non-JSON/i);
  });

  it('throws CliError on malformed list shape', async () => {
    mockFetch(async () => jsonResponse(200, { data: [] }));

    await expect(loadFromApi(resolved())).rejects.toThrow(
      /Malformed response/i,
    );
  });

  it('throws CliError when fetch rejects', async () => {
    mockFetch(async () => {
      throw new Error('ECONNREFUSED');
    });

    await expect(loadFromApi(resolved())).rejects.toThrow(
      /Failed to reach Hightouch API/i,
    );
  });

  it('throws CliError when a domain fails validation', async () => {
    mockFetch(async () =>
      jsonResponse(200, {
        data: [{ events: [] }],
        hasMore: false,
      }),
    );

    await expect(loadFromApi(resolved())).rejects.toThrow(/Invalid domain/i);
  });

  it('throws CliError when token is missing', async () => {
    mockFetch(async () => {
      throw new Error('should not be called');
    });

    await expect(
      loadFromApi({ ...resolved(), token: undefined }),
    ).rejects.toThrow(/token/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
