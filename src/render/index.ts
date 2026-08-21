import type { SupportedSdk } from '../config/schema';
import type { NormalizedEvent } from '../normalize/types';
import { renderAndroid } from './android';
import { renderBrowserTs } from './browser-ts';
import { renderGo } from './go';
import { renderSwift } from './swift';

/**
 * Emit generated source for one `outputs[].sdk` entry.
 *
 * To add a target, follow `src/render/README.md` — do not call a renderer
 * directly from the pipeline.
 */
export async function renderSdk(
  sdk: SupportedSdk,
  events: NormalizedEvent[],
): Promise<string> {
  switch (sdk) {
    case 'browser-ts':
      return renderBrowserTs(events);
    case 'go':
      return renderGo(events);
    case 'swift':
      return renderSwift(events);
    case 'android':
      return renderAndroid(events);
    default: {
      const exhaustive: never = sdk;
      throw new Error(`Unsupported SDK: ${String(exhaustive)}`);
    }
  }
}
