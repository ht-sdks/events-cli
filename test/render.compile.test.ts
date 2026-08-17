import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import ts from 'typescript';
import { renderBrowserTs } from '../src/render/browser-ts';
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

describe('renderBrowserTs compile harness', () => {
  it.each(['simple-track.json', 'multi-version.json', 'with-refs.json'])(
    'typechecks generated %s against the browser SDK',
    async (file) => {
      const source = await renderBrowserTs(eventsFromFixture(file));
      const diagnostics = compileGenerated(source);
      const text = ts.formatDiagnostics(diagnostics, {
        getCanonicalFileName: (name) => name,
        getCurrentDirectory: () => packageRoot,
        getNewLine: () => '\n',
      });
      expect(text).toBe('');
    },
  );

  it('typechecks generated group wrappers against the browser SDK', async () => {
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
    const diagnostics = compileGenerated(await renderBrowserTs([event]));
    const text = ts.formatDiagnostics(diagnostics, {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => packageRoot,
      getNewLine: () => '\n',
    });
    expect(text).toBe('');
  });
});
