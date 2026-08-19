/**
 * Fixture generator for the Go compile harness — not a Jest test and not
 * quicktype input. Runs `renderGo()` over domain fixtures plus extra event
 * types, writes gitignored `test/harness/go/analytics/generated.go`, gofmt.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { spawnSync } from 'child_process';
import { eventsFromFixture } from '../test/helpers/fixtures';
import type { NormalizedEvent } from '../src/normalize/types';
import { renderGo } from '../src/render/go';

const OUT = join(
  __dirname,
  '..',
  'test',
  'harness',
  'go',
  'analytics',
  'generated.go',
);

function extraEvents(): NormalizedEvent[] {
  return [
    {
      type: 'group',
      version: 'default',
      domainName: 'Accounts',
      envelopeKey: 'traits',
      schema: {
        type: 'object',
        properties: { name: { type: 'string' } },
      },
      wrapperName: 'groupDefault',
      latestAlias: 'group',
    },
    {
      type: 'alias',
      version: 'default',
      domainName: 'Users',
      envelopeKey: 'properties',
      schema: { type: 'object' },
      wrapperName: 'aliasDefault',
      latestAlias: 'alias',
    },
    {
      type: 'page',
      name: 'Home',
      version: 'default',
      domainName: 'Web',
      envelopeKey: 'properties',
      schema: {
        type: 'object',
        properties: { path: { type: 'string' } },
      },
      wrapperName: 'pageHomeDefault',
      latestAlias: 'pageHome',
    },
    {
      type: 'screen',
      name: 'Home',
      version: 'default',
      domainName: 'Mobile',
      envelopeKey: 'properties',
      schema: {
        type: 'object',
        properties: { path: { type: 'string' } },
      },
      wrapperName: 'screenHomeDefault',
      latestAlias: 'screenHome',
    },
    {
      type: 'track',
      name: 'Order Completed',
      version: 'v1',
      domainName: 'OrdersProps',
      envelopeKey: 'properties',
      schemaVersionPath: ['properties', 'apiVersion'],
      schema: {
        type: 'object',
        properties: { orderId: { type: 'string' } },
      },
      wrapperName: 'trackOrderCompletedPropsV1',
    },
    {
      type: 'identify',
      version: 'v1',
      domainName: 'UsersTraits',
      envelopeKey: 'traits',
      schemaVersionPath: ['traits', 'apiVersion'],
      schema: {
        type: 'object',
        properties: { email: { type: 'string' } },
      },
      wrapperName: 'identifyTraitsV1',
    },
    {
      type: 'identify',
      version: 'v1',
      domainName: 'UsersWrongEnvelope',
      envelopeKey: 'traits',
      schemaVersionPath: ['properties', 'apiVersion'],
      schema: {
        type: 'object',
        properties: { email: { type: 'string' } },
      },
      wrapperName: 'identifyWrongEnvelopeV1',
    },
    {
      type: 'track',
      name: 'Order Completed',
      version: 'v1',
      domainName: 'OrdersWrongEnvelope',
      envelopeKey: 'properties',
      schemaVersionPath: ['traits', 'apiVersion'],
      schema: {
        type: 'object',
        properties: { orderId: { type: 'string' } },
      },
      wrapperName: 'trackWrongEnvelopeV1',
    },
    {
      type: 'alias',
      version: 'v1',
      domainName: 'UsersAliasCtx',
      envelopeKey: 'properties',
      schemaVersionPath: ['context', 'protocols', 'schemaVersion'],
      schema: { type: 'object' },
      wrapperName: 'aliasContextV1',
    },
    {
      type: 'alias',
      version: 'v1',
      domainName: 'UsersAliasProps',
      envelopeKey: 'properties',
      schemaVersionPath: ['properties', 'apiVersion'],
      schema: { type: 'object' },
      wrapperName: 'aliasPropsV1',
    },
    {
      type: 'track',
      name: 'Signed Up',
      version: 'default',
      domainName: 'Auth',
      envelopeKey: 'properties',
      schemaVersionPath: ['context', 'protocols', 'schemaVersion'],
      schema: {
        type: 'object',
        properties: { plan: { type: 'string' } },
      },
      wrapperName: 'trackSignedUpDefault',
      latestAlias: 'trackSignedUp',
    },
  ];
}

export async function emitGoHarness(): Promise<void> {
  const events = [
    ...eventsFromFixture('multi-version.json'),
    ...eventsFromFixture('with-refs.json'),
    ...extraEvents(),
  ];
  const source = await renderGo(events);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, source);
  const formatted = spawnSync('gofmt', ['-w', OUT], { encoding: 'utf-8' });
  if (formatted.status !== 0 && formatted.error) {
    console.error(
      `Wrote ${OUT} (gofmt not available: ${formatted.error.message})`,
    );
    return;
  }
  if (formatted.status !== 0) {
    console.error(formatted.stderr);
    process.exit(formatted.status ?? 1);
  }
  console.error(`Wrote ${OUT}`);
}

const isDirect =
  process.argv[1] !== undefined &&
  /emit-go-harness\.(ts|js)$/.test(process.argv[1]);

if (isDirect) {
  void emitGoHarness();
}
