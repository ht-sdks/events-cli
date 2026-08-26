import { renderHeader } from '../shared/header';
import { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';

export function phpFilePreamble(): string {
  return [
    '<?php',
    '',
    renderHeader(MIN_SDK_PACKAGE, MIN_SDK_VERSION, { linePrefix: '// ' }),
    '//',
    '// Composer PSR-4 (do not edit the customer composer.json from generate):',
    '//   "Hightouch\\\\Generated\\\\": "src/Hightouch/Generated/"',
    '',
    'declare(strict_types=1);',
    '',
    '',
  ].join('\n');
}
