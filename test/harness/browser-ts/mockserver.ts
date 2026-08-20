import { createServer, type IncomingMessage, type Server } from 'node:http';

/**
 * HtEventsBrowser reads window.location / pagehide / navigator. This is a
 * Node stub, not jsdom — enough for the SDK to load and POST.
 */
export function stubBrowserGlobals(): void {
  const existing = globalThis as typeof globalThis & {
    window?: { location?: { href?: string } };
  };
  if (existing.window?.location?.href !== undefined) {
    return;
  }

  const location = {
    href: 'http://localhost/',
    search: '',
    hash: '',
    hostname: 'localhost',
    pathname: '/',
    protocol: 'http:',
  };
  const document = {
    cookie: '',
    title: '',
    referrer: '',
    querySelector: () => null,
  };
  const window = {
    addEventListener(): void {},
    removeEventListener(): void {},
    navigator: {
      onLine: true,
      userAgent:
        typeof globalThis.navigator === 'object' &&
        globalThis.navigator !== null &&
        'userAgent' in globalThis.navigator &&
        typeof globalThis.navigator.userAgent === 'string'
          ? globalThis.navigator.userAgent
          : 'events-cli-harness',
      language: 'en-US',
    },
    location,
    document,
  };
  Object.defineProperty(globalThis, 'window', {
    value: window,
    writable: true,
  });
  Object.defineProperty(globalThis, 'document', {
    value: document,
    writable: true,
  });
  Object.defineProperty(globalThis, 'location', {
    value: location,
    writable: true,
  });
}

export type CapturedRequest = {
  url: string;
  body: Record<string, unknown>;
};

export async function mockServer(): Promise<{
  host: string;
  close: () => Promise<void>;
  next: () => Promise<CapturedRequest>;
}> {
  const pending: Array<(value: CapturedRequest) => void> = [];
  const queued: CapturedRequest[] = [];

  const server: Server = createServer((req, res) => {
    void readJson(req)
      .catch(() => ({}))
      .then((body) => {
        const captured: CapturedRequest = {
          url: req.url ?? '',
          body,
        };
        const resolve = pending.shift();
        if (resolve !== undefined) {
          resolve(captured);
        } else {
          queued.push(captured);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
      });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('expected TCP address');
  }

  return {
    host: `127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err !== undefined ? reject(err) : resolve()));
      }),
    next: () =>
      new Promise((resolve) => {
        const queuedBody = queued.shift();
        if (queuedBody !== undefined) {
          resolve(queuedBody);
          return;
        }
        pending.push(resolve);
      }),
  };
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}
