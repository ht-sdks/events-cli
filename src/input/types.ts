import { z } from 'zod';

export const COMPONENT_REF_PREFIX = '#/definitions/components/';

const jsonSchemaSchema = z.record(z.unknown());

export const domainEventSchema = z.object({
  type: z.enum(['track', 'identify', 'page', 'screen', 'group', 'alias']),
  name: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  slug: z.string().optional(),
  version: z.string().optional(),
  onSchemaViolation: z.enum(['ALLOW_EVENT', 'BLOCK_EVENT']).optional(),
  onUndeclaredFields: z
    .enum(['ALLOW_EVENT', 'BLOCK_EVENT', 'OMIT_FIELDS'])
    .optional(),
  schema: jsonSchemaSchema,
});

export const domainComponentSchema = z.object({
  id: z.string().optional(),
  slug: z.string().optional(),
  name: z.string().min(1),
  version: z.string().optional(),
  description: z.string().optional(),
  schema: jsonSchemaSchema,
  imports: z.array(z.string()).optional(),
});

export const domainSchema = z.object({
  id: z.string().optional(),
  workspaceId: z.number().optional(),
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  onUndeclaredSchema: z.enum(['ALLOW_EVENT', 'BLOCK_EVENT']).optional(),
  schemaVersionPath: z.array(z.string()).optional(),
  events: z.array(domainEventSchema).optional(),
  components: z.array(domainComponentSchema).optional(),
  eventSources: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    )
    .optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const contractBundleSchema = z.object({
  source: z.string().min(1),
  domains: z.array(domainSchema),
});

export type JsonSchema = z.infer<typeof jsonSchemaSchema>;
export type DomainEvent = z.infer<typeof domainEventSchema>;
export type EventType = DomainEvent['type'];
export type DomainComponent = z.infer<typeof domainComponentSchema>;
export type DomainEventSource = NonNullable<
  z.infer<typeof domainSchema>['eventSources']
>[number];
export type Domain = z.infer<typeof domainSchema>;
export type ContractBundle = z.infer<typeof contractBundleSchema>;
