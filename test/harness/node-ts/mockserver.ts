import { createServer, type IncomingMessage, type Server } from 'node:http';

export type CapturedRequest = {
  url: string;
  body: Record<string, unknown>;
};

function firstMessage(body: Record<string, unknown>): Record<string, unknown> {
  const batch = body.batch;
  if (Array.isArray(batch) && batch.length > 0) {
    const first = batch[0];
    if (typeof first === 'object' && first !== null) {
      return first as Record<string, unknown>;
    }
  }
  return body;
}

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
          body: firstMessage(body),
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
    host: `http://127.0.0.1:${address.port}`,
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
