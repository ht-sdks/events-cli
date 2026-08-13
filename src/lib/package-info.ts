import { readFileSync } from 'fs';
import { join } from 'path';

type PackageJson = { name: string; version: string };

let cached: PackageJson | undefined;

export function cliPackage(): PackageJson {
  if (cached) return cached;
  const pkgPath = join(__dirname, '..', '..', 'package.json');
  cached = JSON.parse(readFileSync(pkgPath, 'utf-8')) as PackageJson;
  return cached;
}
