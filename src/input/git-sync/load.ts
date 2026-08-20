import { readFileSync } from 'fs';
import { relative, sep } from 'path';
import { parse as parseYaml } from 'yaml';
import { ZodError, z } from 'zod';
import type { ResolvedConfig } from '../../config/resolve';
import { CliError } from '../../lib/errors';
import { info } from '../../lib/output';
import { parseContractBundle, parseDomain } from '../parse';
import type {
  ContractBundle,
  Domain,
  DomainComponent,
  DomainEvent,
} from '../types';
import {
  classifyPath,
  listYamlFiles,
  resolveGitSyncLayout,
  yamlFilenameSlug,
  type ContractDirShape,
  type PathKind,
} from './layout';

const gitDomainMetaSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  onUndeclaredSchema: z.enum(['ALLOW_EVENT', 'BLOCK_EVENT']).optional(),
  sources: z.array(z.string().min(1)).optional(),
});

const gitEventSchema = z.object({
  type: z.enum(['track', 'identify', 'page', 'screen', 'group', 'alias']),
  name: z.string().nullish(),
  version: z.string().optional(),
  onSchemaViolation: z.enum(['ALLOW_EVENT', 'BLOCK_EVENT']).optional(),
  onUndeclaredFields: z
    .enum(['ALLOW_EVENT', 'BLOCK_EVENT', 'OMIT_FIELDS'])
    .optional(),
  includeBuiltInContext: z.boolean().optional(),
  schema: z.record(z.unknown()),
});

const gitComponentSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
  description: z.string().optional(),
  sources: z.array(z.string().min(1)).optional(),
  schema: z.record(z.unknown()),
});

type DraftComponent = DomainComponent & {
  /** YAML `sources` whitelist; undefined if the key was omitted. */
  yamlSources?: string[];
};

type DomainDraft = {
  slug: string;
  meta?: z.infer<typeof gitDomainMetaSchema>;
  metaFile?: string;
  events: DomainEvent[];
  components: DraftComponent[];
  files: string[];
};

function domainAppliesToSource(
  sources: string[] | undefined,
  source: string,
): boolean {
  if (sources === undefined) return true;
  if (sources.length === 0) return false;
  return sources.includes(source);
}

function componentAppliesToSource(
  sources: string[] | undefined,
  source: string,
): boolean {
  if (sources === undefined || sources.length === 0) return true;
  return sources.includes(source);
}

export async function loadFromGitSync(
  resolvedConfig: ResolvedConfig,
): Promise<ContractBundle> {
  if (resolvedConfig.config.input.type !== 'git-sync') {
    throw new CliError(
      'loadFromGitSync requires config.input.type to be "git-sync".',
    );
  }

  const layout = resolveGitSyncLayout(
    resolvedConfig.configPath,
    resolvedConfig.config.input.path,
  );

  const source = resolvedConfig.config.source.trim();
  if (!source) {
    throw new CliError('Config "source" (event source slug) must not be empty.');
  }

  const drafts = new Map<string, DomainDraft>();
  for (const file of listYamlFiles(layout.eventsRoot)) {
    const kind = classifyPath(layout.shape, layout.eventsRoot, file);
    if (kind === 'other') continue;
    ingestFile(drafts, layout.shape, layout.eventsRoot, file, kind);
  }

  const domains: Domain[] = [...drafts.values()]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .flatMap((draft) => {
      if (!draft.meta) {
        throw new CliError(
          `No domain metadata file for slug "${draft.slug}". ` +
            `Referenced by: ${draft.files.join(', ')}`,
        );
      }
      if (!domainAppliesToSource(draft.meta.sources, source)) {
        return [];
      }
      const components = draft.components
        .filter((component) =>
          componentAppliesToSource(component.yamlSources, source),
        )
        .map(({ yamlSources: _yamlSources, ...component }) => component);
      return [
        parseDomain({
          name: draft.meta.name,
          slug: draft.slug,
          ...(draft.meta.description !== undefined
            ? { description: draft.meta.description }
            : {}),
          ...(draft.meta.onUndeclaredSchema !== undefined
            ? { onUndeclaredSchema: draft.meta.onUndeclaredSchema }
            : {}),
          ...(draft.meta.sources !== undefined
            ? {
                eventSources: draft.meta.sources.map((slug) => ({
                  id: slug,
                  name: slug,
                })),
              }
            : {}),
          events: draft.events,
          components,
        }),
      ];
    });

  info(
    `Loaded ${domains.length} domain(s) from git-sync (${layout.shape} layout) ` +
      `for source "${source}". Domains/components without a YAML sources key ` +
      'are included (layouts that predate source scoping).',
  );

  return parseContractBundle({
    source,
    domains,
  });
}

function ingestFile(
  drafts: Map<string, DomainDraft>,
  shape: ContractDirShape,
  eventsRoot: string,
  file: string,
  kind: PathKind,
): void {
  const rel = relative(eventsRoot, file).split(sep).join('/');
  const parts = rel.split('/');
  const { domainSlug, resourceSlug } = slugsFromParts(shape, kind, parts);

  if (
    kind === 'schema' &&
    shape === 'domains' &&
    resourceSlug?.toLowerCase() === 'domain'
  ) {
    throw new CliError(
      `Schema slug "domain" is reserved in the domains layout (would collide with domain.yaml): ${file}`,
    );
  }

  const draft = drafts.get(domainSlug) ?? {
    slug: domainSlug,
    events: [],
    components: [],
    files: [],
  };
  draft.files.push(file);

  const raw = readYamlFile(file);

  if (kind === 'meta') {
    if (draft.meta) {
      throw new CliError(
        `Duplicate domain metadata for slug "${domainSlug}": ${draft.metaFile} and ${file}`,
      );
    }
    draft.meta = parseYamlSchema(gitDomainMetaSchema, raw, file);
    draft.metaFile = file;
  } else if (kind === 'schema') {
    const parsed = parseYamlSchema(gitEventSchema, raw, file);
    draft.events.push({
      type: parsed.type,
      ...(parsed.name != null ? { name: parsed.name } : {}),
      slug: resourceSlug,
      ...(parsed.version !== undefined ? { version: parsed.version } : {}),
      ...(parsed.onSchemaViolation !== undefined
        ? { onSchemaViolation: parsed.onSchemaViolation }
        : {}),
      ...(parsed.onUndeclaredFields !== undefined
        ? { onUndeclaredFields: parsed.onUndeclaredFields }
        : {}),
      schema: parsed.schema,
    });
  } else {
    const parsed = parseYamlSchema(gitComponentSchema, raw, file);
    draft.components.push({
      slug: resourceSlug,
      name: parsed.name,
      ...(parsed.version !== undefined ? { version: parsed.version } : {}),
      ...(parsed.description !== undefined
        ? { description: parsed.description }
        : {}),
      ...(parsed.sources !== undefined ? { yamlSources: parsed.sources } : {}),
      schema: parsed.schema,
    });
  }

  drafts.set(domainSlug, draft);
}

function slugsFromParts(
  shape: ContractDirShape,
  kind: PathKind,
  parts: string[],
): { domainSlug: string; resourceSlug?: string } {
  if (shape === 'contracts') {
    if (kind === 'meta') {
      return { domainSlug: yamlFilenameSlug(parts[1] ?? '') };
    }
    return {
      domainSlug: parts[1] ?? '',
      resourceSlug: yamlFilenameSlug(parts[2] ?? ''),
    };
  }
  const domainSlug = parts[1] ?? '';
  if (kind === 'meta') return { domainSlug };
  if (kind === 'component') {
    return { domainSlug, resourceSlug: yamlFilenameSlug(parts[3] ?? '') };
  }
  return { domainSlug, resourceSlug: yamlFilenameSlug(parts[2] ?? '') };
}

function readYamlFile(file: string): unknown {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new CliError(`Cannot read ${file}: ${detail}`);
  }
  try {
    return parseYaml(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new CliError(`Invalid YAML in ${file}: ${detail}`);
  }
}

function parseYamlSchema<T>(
  schema: z.ZodType<T>,
  raw: unknown,
  file: string,
): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new CliError(
      `Invalid git-sync file ${file}:\n${formatZodError(result.error)}`,
    );
  }
  return result.data;
}

function formatZodError(err: ZodError): string {
  return err.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('\n');
}
