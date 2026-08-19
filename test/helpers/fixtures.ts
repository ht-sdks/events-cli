import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDomain } from '../../src/input/parse';
import { normalize } from '../../src/normalize';
import type { ContractBundle } from '../../src/input/types';
import type { NormalizedEvent } from '../../src/normalize/types';

const fixtures = join(__dirname, '..', 'fixtures', 'domains');

export function eventsFromFixture(file: string): NormalizedEvent[] {
  const bundle: ContractBundle = {
    writeKey: 'wk',
    domains: [
      parseDomain(JSON.parse(readFileSync(join(fixtures, file), 'utf-8'))),
    ],
  };
  return normalize(bundle);
}
