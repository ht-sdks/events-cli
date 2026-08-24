import type { SupportedSdk } from '../config/schema';
import type { NormalizedEvent } from '../normalize/types';
import { renderAndroid } from './android';
import { renderBrowserTs } from './browser-ts';
import { renderGo } from './go';
import { renderJava } from './java';
import { renderKotlin } from './kotlin';
import { renderNodeTs } from './node-ts';
import { renderPhp } from './php';
import { renderPython } from './python';
import { renderRuby } from './ruby';
import { renderSwift } from './swift';

export type RenderOptions = {
  /** Config-relative `outputs[].path`. JVM uses this for package + class names. */
  outputPath?: string;
};

/**
 * Emit generated source for one `outputs[].sdk` entry.
 *
 * To add a target, follow `src/render/README.md` — do not call a renderer
 * directly from the pipeline.
 */
export async function renderSdk(
  sdk: SupportedSdk,
  events: NormalizedEvent[],
  options: RenderOptions = {},
): Promise<string> {
  switch (sdk) {
    case 'browser-ts':
      return renderBrowserTs(events);
    case 'node-ts':
      return renderNodeTs(events);
    case 'python':
      return renderPython(events);
    case 'ruby':
      return renderRuby(events);
    case 'php':
      return renderPhp(events);
    case 'go':
      return renderGo(events);
    case 'swift':
      return renderSwift(events);
    case 'android':
      return renderAndroid(events, options.outputPath);
    case 'kotlin':
      return renderKotlin(events, options.outputPath);
    case 'java':
      return renderJava(events, options.outputPath);
    default: {
      const exhaustive: never = sdk;
      throw new Error(`Unsupported SDK: ${String(exhaustive)}`);
    }
  }
}
