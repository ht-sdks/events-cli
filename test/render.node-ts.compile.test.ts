import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import ts from 'typescript';
import { renderNodeTs } from '../src/render/node-ts';
import { eventsFromFixture } from './helpers/fixtures';
import type { NormalizedEvent } from '../src/normalize/types';

const packageRoot = join(__dirname, '..');

function compileGenerated(source: string): ts.Diagnostic[] {
  const dir = mkdtempSync(join(packageRoot, '.tmp-render-'));
  const file = join(dir, 'generated.ts');
  try {
    writeFileSync(file, source, 'utf-8');
    const program = ts.createProgram([file], {
      noEmit: true,
      strict: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.Node16,
      moduleResolution: ts.ModuleResolutionKind.Node16,
      skipLibCheck: true,
      esModuleInterop: true,
    });
    return [
      ...program.getSyntacticDiagnostics(),
      ...program.getSemanticDiagnostics(),
    ];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function format(diagnostics: ts.Diagnostic[]): string {
  return ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: (name) => name,
    getCurrentDirectory: () => packageRoot,
    getNewLine: () => '\n',
  });
}

describe('renderNodeTs compile harness', () => {
  it.each(['simple-track.json', 'multi-version.json', 'with-refs.json'])(
    'typechecks generated %s against the node SDK',
    async (file) => {
      const source = await renderNodeTs(eventsFromFixture(file));
      expect(format(compileGenerated(source))).toBe('');
    },
  );

  it('typechecks generated group wrappers against the node SDK', async () => {
    const event: NormalizedEvent = {
      type: 'group',
      version: 'default',
      domainName: 'Accounts',
      envelopeKey: 'traits',
      schema: {
        type: 'object',
        properties: { name: { type: 'string' } },
      },
      wrapperName: 'groupDefault',
    };
    expect(format(compileGenerated(await renderNodeTs([event])))).toBe('');
  });

  it('typechecks generated track wrappers with an empty properties schema', async () => {
    const event: NormalizedEvent = {
      type: 'track',
      name: 'Unscoped Ping',
      version: 'default',
      domainName: 'Unscoped',
      envelopeKey: 'properties',
      schema: { type: 'object' },
      wrapperName: 'trackUnscopedPingDefault',
    };
    expect(format(compileGenerated(await renderNodeTs([event])))).toBe('');
  });

  it('typechecks generated alias wrappers against the node SDK', async () => {
    const event: NormalizedEvent = {
      type: 'alias',
      version: 'default',
      domainName: 'Users',
      envelopeKey: 'properties',
      schema: { type: 'object' },
      wrapperName: 'aliasDefault',
    };
    expect(format(compileGenerated(await renderNodeTs([event])))).toBe('');
  });
});
