import { renderSlashHeader } from '../shared/header';
import { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';

export function renderHeader(): string {
  return renderSlashHeader(MIN_SDK_PACKAGE, MIN_SDK_VERSION);
}
