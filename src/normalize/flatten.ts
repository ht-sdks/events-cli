/** Port of `flattenComponentRefs` from the monorepo. */

import { CliError } from '../lib/errors';
import { COMPONENT_REF_PREFIX } from '../input/types';

export type SchemaComponent = {
  slug: string;
  schema: unknown;
};

const RESERVED_PROPERTY_KEY = '__proto__';
const MAX_EFFECTIVE_SCHEMA_NODES = 10_000;

function refSlug(node: unknown): string | null {
  if (
    node === null ||
    typeof node !== 'object' ||
    Array.isArray(node) ||
    typeof (node as { $ref?: unknown }).$ref !== 'string' ||
    !(node as { $ref: string }).$ref.startsWith(COMPONENT_REF_PREFIX)
  ) {
    return null;
  }
  const slug = (node as { $ref: string }).$ref.slice(
    COMPONENT_REF_PREFIX.length,
  );
  return slug.length > 0 ? slug : null;
}

function indexBySlug(
  components: SchemaComponent[],
): Map<string, SchemaComponent> {
  const bySlug = new Map<string, SchemaComponent>();
  for (const component of components) {
    if (!bySlug.has(component.slug)) {
      bySlug.set(component.slug, component);
    }
  }
  return bySlug;
}

function setKey(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  if (key === RESERVED_PROPERTY_KEY) {
    Object.defineProperty(target, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  } else {
    target[key] = value;
  }
}

function mergeFlat(out: Record<string, unknown>, resolved: unknown): void {
  if (resolved === null || typeof resolved !== 'object') return;
  const resolvedObj = resolved as Record<string, unknown>;

  const incoming = resolvedObj.properties;
  if (incoming !== null && typeof incoming === 'object') {
    if (out.properties === null || typeof out.properties !== 'object') {
      out.properties = {};
    }
    const outProps = out.properties as Record<string, unknown>;
    for (const field of Object.keys(incoming as object)) {
      setKey(outProps, field, (incoming as Record<string, unknown>)[field]);
    }
  }

  if (Array.isArray(resolvedObj.required) && resolvedObj.required.length > 0) {
    const union = new Set<string>(
      Array.isArray(out.required) ? (out.required as string[]) : [],
    );
    for (const field of resolvedObj.required) {
      if (typeof field === 'string') union.add(field);
    }
    out.required = [...union];
  }
}

function resolveNode(
  node: unknown,
  bySlug: Map<string, SchemaComponent>,
  visiting: Set<string>,
  budget: { count: number },
): unknown {
  if (++budget.count > MAX_EFFECTIVE_SCHEMA_NODES) {
    throw new CliError(
      `Component ref expansion exceeds ${MAX_EFFECTIVE_SCHEMA_NODES} nodes.`,
    );
  }
  if (Array.isArray(node)) {
    return node.map((item) => resolveNode(item, bySlug, visiting, budget));
  }
  if (node === null || typeof node !== 'object') {
    return node;
  }

  const nestedSlug = refSlug(node);
  if (nestedSlug !== null) {
    const target = bySlug.get(nestedSlug);
    if (!target) return {};
    if (visiting.has(nestedSlug)) {
      throw new CliError(`Component ref cycle detected at "${nestedSlug}".`);
    }
    visiting.add(nestedSlug);
    const resolved = resolveNode(target.schema, bySlug, visiting, budget);
    visiting.delete(nestedSlug);
    return resolved;
  }

  const nodeObj = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(nodeObj)) {
    if (key === 'allOf') continue;
    setKey(out, key, resolveNode(nodeObj[key], bySlug, visiting, budget));
  }

  if (Array.isArray(nodeObj.allOf)) {
    const leftover: unknown[] = [];
    for (const entry of nodeObj.allOf) {
      const slug = refSlug(entry);
      if (slug === null) {
        leftover.push(resolveNode(entry, bySlug, visiting, budget));
        continue;
      }
      const target = bySlug.get(slug);
      if (!target) continue;
      if (visiting.has(slug)) {
        throw new CliError(`Component ref cycle detected at "${slug}".`);
      }
      visiting.add(slug);
      mergeFlat(out, resolveNode(target.schema, bySlug, visiting, budget));
      visiting.delete(slug);
    }
    if (leftover.length > 0) out.allOf = leftover;
  }

  return out;
}

export function flattenComponentRefs(
  schema: unknown,
  components: SchemaComponent[],
): unknown {
  const bySlug = indexBySlug(components ?? []);
  return resolveNode(schema, bySlug, new Set(), { count: 0 });
}
