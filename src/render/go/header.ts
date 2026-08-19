import { headerLines } from '../shared/header';
import { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';

export function renderHeader(): string {
  const { generated, requires } = headerLines(MIN_SDK_PACKAGE, MIN_SDK_VERSION);
  return [`// ${generated}`, `// ${requires}`].join('\n');
}
