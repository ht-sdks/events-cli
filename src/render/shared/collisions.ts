import { CliError } from '../../lib/errors';
import type { NormalizedEvent } from '../../normalize/types';

export type CollisionOptions = {
  label: string;
  methodName: (wrapperName: string) => string;
  typeNameFor?: (event: NormalizedEvent) => string;
  /** When set with `typeNameFor`, types share the method namespace (Go). */
  sharedPool?: boolean;
  includeType?: (event: NormalizedEvent) => boolean;
  reserved?: ReadonlySet<string>;
  typeKey?: (name: string) => string;
};

export function assertNoCollisions(
  events: readonly NormalizedEvent[],
  opts: CollisionOptions,
): void {
  const methods = new Map<string, string>();
  const types = opts.sharedPool ? methods : new Map<string, string>();
  const typeKey = opts.typeKey ?? ((name: string) => name);
  const includeType =
    opts.includeType ?? ((event: NormalizedEvent) => event.type !== 'alias');

  const claim = (
    owners: Map<string, string>,
    name: string,
    label: string,
    kind: 'method' | 'type',
  ) => {
    if (opts.reserved?.has(name)) {
      throw new CliError(
        `${opts.label} identifier collision: "${name}" (${kind} from ${label}) is a reserved ${opts.label} name.`,
      );
    }
    const key = kind === 'type' ? typeKey(name) : name;
    const existing = owners.get(key);
    if (existing !== undefined) {
      throw new CliError(
        `${opts.label} identifier collision: "${name}" is produced by both ${existing} and ${label}.`,
      );
    }
    owners.set(key, label);
  };

  for (const event of events) {
    const label = event.wrapperName;
    claim(methods, opts.methodName(event.wrapperName), label, 'method');
    if (opts.typeNameFor !== undefined && includeType(event)) {
      claim(types, opts.typeNameFor(event), label, 'type');
    }
    if (event.latestAlias !== undefined) {
      claim(methods, opts.methodName(event.latestAlias), label, 'method');
    }
  }
}
