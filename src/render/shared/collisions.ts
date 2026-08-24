import { CliError } from '../../lib/errors';
import type { NormalizedEvent } from '../../normalize/types';

export type CollisionOptions = {
  /** CliError prefix only: `"${errorPrefixLabel} identifier collision: ..."`. */
  errorPrefixLabel: string;
  /**
   * Return the method/function name as it will appear in generated code
   * for this wrapper id (`wrapperName` or `latestAlias`).
   */
  generatedMethodName: (wrapperName: string) => string;
  /**
   * Return the payload type name as it will appear in generated code.
   * Omit if those types cannot collide with methods (Swift).
   */
  generatedTypeName?: (event: NormalizedEvent) => string;
};

export function assertNoCollisions(
  events: readonly NormalizedEvent[],
  opts: CollisionOptions,
): void {
  const owners = new Map<string, string>();

  const claim = (name: string, owner: string) => {
    const existing = owners.get(name);
    if (existing !== undefined) {
      throw new CliError(
        `${opts.errorPrefixLabel} identifier collision: "${name}" is produced by both ${existing} and ${owner}.`,
      );
    }
    owners.set(name, owner);
  };

  for (const event of events) {
    const owner = event.wrapperName;
    claim(opts.generatedMethodName(event.wrapperName), owner);
    if (opts.generatedTypeName !== undefined) {
      claim(opts.generatedTypeName(event), owner);
    }
    if (event.latestAlias !== undefined) {
      claim(opts.generatedMethodName(event.latestAlias), owner);
    }
  }
}
