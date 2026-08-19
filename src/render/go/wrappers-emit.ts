import type { NormalizedEvent } from '../../normalize/types';
import { injectableSchemaVersionPath } from '../shared/injection';
import { assertNoExportedCollisions, exportedName, typeNameFor } from './names';

/** SDK call shape for Go. Injection policy: `src/render/shared/injection.ts`. */

function goString(value: string): string {
  return JSON.stringify(value);
}

function goStringSlice(values: readonly string[] | undefined): string {
  if (values === undefined || values.length === 0) {
    return 'nil';
  }
  return `[]string{${values.map(goString).join(', ')}}`;
}

function sdkMessageType(event: NormalizedEvent): string {
  return event.type.charAt(0).toUpperCase() + event.type.slice(1);
}

function eventNameLiteral(event: NormalizedEvent): string {
  return goString(event.name ?? event.type);
}

function renderHelpers(): string {
  return [
    'type CallOptions struct {',
    '\tAnonymousID  string',
    '\tContext      *htevents.Context',
    '\tIntegrations htevents.Integrations',
    '\tTimestamp    time.Time',
    '\tMessageID    string',
    '}',
    '',
    'func firstCallOptions(opts []CallOptions) CallOptions {',
    '\tif len(opts) == 0 {',
    '\t\treturn CallOptions{}',
    '\t}',
    '\treturn opts[0]',
    '}',
    '',
    'func cloneMap(m map[string]interface{}) map[string]interface{} {',
    '\tout := make(map[string]interface{}, len(m))',
    '\tfor k, v := range m {',
    '\t\tout[k] = v',
    '\t}',
    '\treturn out',
    '}',
    '',
    'func cloneContext(ctx *htevents.Context) *htevents.Context {',
    '\tif ctx == nil {',
    '\t\treturn &htevents.Context{}',
    '\t}',
    '\tcopied := *ctx',
    '\tif ctx.Extra != nil {',
    '\t\tcopied.Extra = cloneMap(ctx.Extra)',
    '\t}',
    '\treturn &copied',
    '}',
    '',
    'func setAtPath(root map[string]interface{}, path []string, value string) map[string]interface{} {',
    '\tif len(path) == 0 {',
    '\t\treturn root',
    '\t}',
    '\tclone := cloneMap(root)',
    '\tcursor := clone',
    '\tfor i := 0; i < len(path)-1; i++ {',
    '\t\tkey := path[i]',
    '\t\tnext, _ := cursor[key].(map[string]interface{})',
    '\t\tchild := cloneMap(next)',
    '\t\tcursor[key] = child',
    '\t\tcursor = child',
    '\t}',
    '\tcursor[path[len(path)-1]] = value',
    '\treturn clone',
    '}',
    '',
    'func toMap(v interface{}) (map[string]interface{}, error) {',
    '\tb, err := json.Marshal(v)',
    '\tif err != nil {',
    '\t\treturn nil, err',
    '\t}',
    '\tvar m map[string]interface{}',
    '\tif err := json.Unmarshal(b, &m); err != nil {',
    '\t\treturn nil, err',
    '\t}',
    '\tif m == nil {',
    '\t\tm = map[string]interface{}{}',
    '\t}',
    '\treturn m, nil',
    '}',
    '',
    'func withSchemaVersion(data map[string]interface{}, ctx *htevents.Context, path []string, version string, envelopeKey string) (map[string]interface{}, *htevents.Context) {',
    '\tif len(path) == 0 {',
    '\t\treturn data, ctx',
    '\t}',
    '\thead, rest := path[0], path[1:]',
    '\tif head == envelopeKey {',
    '\t\treturn setAtPath(cloneMap(data), rest, version), ctx',
    '\t}',
    '\tif head == "context" {',
    '\t\tnext := cloneContext(ctx)',
    '\t\tnext.Extra = setAtPath(cloneMap(next.Extra), rest, version)',
    '\t\treturn data, next',
    '\t}',
    '\treturn data, ctx',
    '}',
  ].join('\n');
}

/** Alias in events-sdk-go has UserId + PreviousId, not AnonymousId. */
function renderAliasWrapper(event: NormalizedEvent): string[] {
  const fn = exportedName(event.wrapperName);
  const pathLiteral = goStringSlice(injectableSchemaVersionPath(event));
  const version = goString(event.version);
  const envelope = goString(event.envelopeKey);
  const lines = [
    `func ${fn}(client htevents.Client, userID string, previousID string, opts ...CallOptions) error {`,
    '\to := firstCallOptions(opts)',
    `\t_, ctx := withSchemaVersion(map[string]interface{}{}, o.Context, ${pathLiteral}, ${version}, ${envelope})`,
    '\treturn client.Enqueue(htevents.Alias{',
    '\t\tUserId:       userID,',
    '\t\tPreviousId:   previousID,',
    '\t\tContext:      ctx,',
    '\t\tIntegrations: o.Integrations,',
    '\t\tTimestamp:    o.Timestamp,',
    '\t\tMessageId:    o.MessageID,',
    '\t})',
    '}',
  ];
  if (event.latestAlias !== undefined) {
    const alias = exportedName(event.latestAlias);
    lines.push(
      '',
      `func ${alias}(client htevents.Client, userID string, previousID string, opts ...CallOptions) error {`,
      `\treturn ${fn}(client, userID, previousID, opts...)`,
      '}',
    );
  }
  return lines;
}

function renderGroupWrapper(event: NormalizedEvent): string[] {
  const fn = exportedName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = goStringSlice(injectableSchemaVersionPath(event));
  const version = goString(event.version);
  const envelope = goString(event.envelopeKey);
  const lines = [
    `func ${fn}(client htevents.Client, groupID string, userID string, traits ${typeName}, opts ...CallOptions) error {`,
    '\to := firstCallOptions(opts)',
    '\tdata, err := toMap(traits)',
    '\tif err != nil {',
    '\t\treturn err',
    '\t}',
    `\tdata, ctx := withSchemaVersion(data, o.Context, ${pathLiteral}, ${version}, ${envelope})`,
    '\treturn client.Enqueue(htevents.Group{',
    '\t\tGroupId:      groupID,',
    '\t\tUserId:       userID,',
    '\t\tAnonymousId:  o.AnonymousID,',
    '\t\tTraits:       htevents.Traits(data),',
    '\t\tContext:      ctx,',
    '\t\tIntegrations: o.Integrations,',
    '\t\tTimestamp:    o.Timestamp,',
    '\t\tMessageId:    o.MessageID,',
    '\t})',
    '}',
  ];
  if (event.latestAlias !== undefined) {
    const alias = exportedName(event.latestAlias);
    lines.push(
      '',
      `func ${alias}(client htevents.Client, groupID string, userID string, traits ${typeName}, opts ...CallOptions) error {`,
      `\treturn ${fn}(client, groupID, userID, traits, opts...)`,
      '}',
    );
  }
  return lines;
}

function renderDataWrapper(event: NormalizedEvent): string[] {
  const fn = exportedName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = goStringSlice(injectableSchemaVersionPath(event));
  const version = goString(event.version);
  const envelope = goString(event.envelopeKey);
  const messageType = sdkMessageType(event);
  const dataField = event.envelopeKey === 'traits' ? 'Traits' : 'Properties';
  const dataCtor =
    event.envelopeKey === 'traits' ? 'htevents.Traits' : 'htevents.Properties';
  const paramName = event.envelopeKey === 'traits' ? 'traits' : 'props';

  const extraFields: string[] = [];
  if (event.type === 'track') {
    extraFields.push(`\t\tEvent:        ${eventNameLiteral(event)},`);
  } else if (event.type === 'page' || event.type === 'screen') {
    extraFields.push(`\t\tName:         ${eventNameLiteral(event)},`);
  }

  const lines = [
    `func ${fn}(client htevents.Client, userID string, ${paramName} ${typeName}, opts ...CallOptions) error {`,
    '\to := firstCallOptions(opts)',
    `\tdata, err := toMap(${paramName})`,
    '\tif err != nil {',
    '\t\treturn err',
    '\t}',
    `\tdata, ctx := withSchemaVersion(data, o.Context, ${pathLiteral}, ${version}, ${envelope})`,
    `\treturn client.Enqueue(htevents.${messageType}{`,
    ...extraFields,
    '\t\tUserId:       userID,',
    '\t\tAnonymousId:  o.AnonymousID,',
    `\t\t${dataField}:   ${dataCtor}(data),`,
    '\t\tContext:      ctx,',
    '\t\tIntegrations: o.Integrations,',
    '\t\tTimestamp:    o.Timestamp,',
    '\t\tMessageId:    o.MessageID,',
    '\t})',
    '}',
  ];
  if (event.latestAlias !== undefined) {
    const alias = exportedName(event.latestAlias);
    lines.push(
      '',
      `func ${alias}(client htevents.Client, userID string, ${paramName} ${typeName}, opts ...CallOptions) error {`,
      `\treturn ${fn}(client, userID, ${paramName}, opts...)`,
      '}',
    );
  }
  return lines;
}

function renderEventWrappers(event: NormalizedEvent): string[] {
  if (event.type === 'alias') {
    return renderAliasWrapper(event);
  }
  if (event.type === 'group') {
    return renderGroupWrapper(event);
  }
  return renderDataWrapper(event);
}

export function renderWrappers(events: NormalizedEvent[]): string {
  assertNoExportedCollisions(events);
  const parts = [renderHelpers()];
  for (const event of events) {
    parts.push(renderEventWrappers(event).join('\n'));
  }
  return parts.join('\n\n');
}
