import type { NormalizedEvent } from '../../normalize/types';
import { assertNoCollisions } from '../shared/collisions';
import { methodName, typeNameFor } from './names';

function phpString(value: string): string {
  return JSON.stringify(value);
}

function phpStringArray(values: readonly string[] | undefined): string {
  if (values === undefined || values.length === 0) {
    return 'null';
  }
  return `[${values.map(phpString).join(', ')}]`;
}

function renderHelpers(): string {
  return [
    '    /** @param mixed $value',
    '     * @return array<string, mixed>',
    '     */',
    '    private static function toMap($value): array',
    '    {',
    '        if ($value === null) {',
    '            return [];',
    '        }',
    '        if (is_array($value)) {',
    '            return $value;',
    '        }',
    '        $out = [];',
    '        foreach (get_object_vars($value) as $key => $val) {',
    '            if ($val !== null) {',
    '                $out[$key] = $val;',
    '            }',
    '        }',
    '        return $out;',
    '    }',
    '',
    '    /**',
    '     * @param array<string, mixed> $root',
    '     * @param list<string> $path',
    '     * @return array<string, mixed>',
    '     */',
    '    private static function setAtPath(array $root, array $path, string $value): array',
    '    {',
    '        if (count($path) === 0) {',
    '            return $root;',
    '        }',
    '        $clone = $root;',
    '        $cursor = &$clone;',
    '        for ($i = 0; $i < count($path) - 1; $i++) {',
    '            $key = $path[$i];',
    '            $next = $cursor[$key] ?? [];',
    '            $cursor[$key] = is_array($next) ? $next : [];',
    '            $cursor = &$cursor[$key];',
    '        }',
    '        $cursor[$path[count($path) - 1]] = $value;',
    '        unset($cursor);',
    '        return $clone;',
    '    }',
    '',
    '    /**',
    '     * @param array<string, mixed> $data',
    '     * @param array<string, mixed>|null $context',
    '     * @param list<string>|null $path',
    '     * @return array{0: array<string, mixed>, 1: array<string, mixed>|null}',
    '     */',
    '    private static function withSchemaVersion(array $data, ?array $context, ?array $path, string $version, string $envelopeKey): array',
    '    {',
    '        if ($path === null || count($path) === 0) {',
    '            return [$data, $context];',
    '        }',
    '        $head = $path[0];',
    '        $rest = array_slice($path, 1);',
    '        if ($head === $envelopeKey) {',
    '            return [self::setAtPath($data, $rest, $version), $context];',
    '        }',
    '        if ($head === "context") {',
    '            $ctx = is_array($context) ? $context : [];',
    '            return [$data, self::setAtPath($ctx, $rest, $version)];',
    '        }',
    '        return [$data, $context];',
    '    }',
  ].join('\n');
}

function optionContext(): string {
  return "$options['context'] ?? null";
}

function extraMessageFields(indent: string): string[] {
  return [
    `${indent}'anonymousId' => $options['anonymousId'] ?? null,`,
    `${indent}'timestamp' => $options['timestamp'] ?? null,`,
    `${indent}'integrations' => $options['integrations'] ?? null,`,
  ];
}

function renderAliasWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const pathLiteral = phpStringArray(event.schemaVersionPath);
  const version = phpString(event.version);
  const envelope = phpString(event.envelopeKey);
  const lines = [
    `    public static function ${fn}(Client $client, string $userId, string $previousId, array $options = []): void`,
    '    {',
    `        [, $ctx] = self::withSchemaVersion([], ${optionContext()}, ${pathLiteral}, ${version}, ${envelope});`,
    '        $client->alias([',
    "            'userId' => $userId,",
    "            'previousId' => $previousId,",
    "            'context' => $ctx,",
    ...extraMessageFields('            '),
    '        ]);',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    lines.push(
      '',
      `    public static function ${methodName(event.latestAlias)}(Client $client, string $userId, string $previousId, array $options = []): void`,
      '    {',
      `        self::${fn}($client, $userId, $previousId, $options);`,
      '    }',
    );
  }
  return lines;
}

function renderGroupWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = phpStringArray(event.schemaVersionPath);
  const version = phpString(event.version);
  const envelope = phpString(event.envelopeKey);
  const lines = [
    `    public static function ${fn}(Client $client, string $groupId, string $userId, ${typeName} $traits, array $options = []): void`,
    '    {',
    `        [$data, $ctx] = self::withSchemaVersion(self::toMap($traits), ${optionContext()}, ${pathLiteral}, ${version}, ${envelope});`,
    '        $client->group([',
    "            'groupId' => $groupId,",
    "            'userId' => $userId,",
    "            'traits' => $data,",
    "            'context' => $ctx,",
    ...extraMessageFields('            '),
    '        ]);',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    lines.push(
      '',
      `    public static function ${methodName(event.latestAlias)}(Client $client, string $groupId, string $userId, ${typeName} $traits, array $options = []): void`,
      '    {',
      `        self::${fn}($client, $groupId, $userId, $traits, $options);`,
      '    }',
    );
  }
  return lines;
}

function renderIdentifyWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = phpStringArray(event.schemaVersionPath);
  const version = phpString(event.version);
  const envelope = phpString(event.envelopeKey);
  const lines = [
    `    public static function ${fn}(Client $client, string $userId, ?${typeName} $traits = null, array $options = []): void`,
    '    {',
    `        [$data, $ctx] = self::withSchemaVersion(self::toMap($traits), ${optionContext()}, ${pathLiteral}, ${version}, ${envelope});`,
    '        $client->identify([',
    "            'userId' => $userId,",
    "            'traits' => $data,",
    "            'context' => $ctx,",
    ...extraMessageFields('            '),
    '        ]);',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    lines.push(
      '',
      `    public static function ${methodName(event.latestAlias)}(Client $client, string $userId, ?${typeName} $traits = null, array $options = []): void`,
      '    {',
      `        self::${fn}($client, $userId, $traits, $options);`,
      '    }',
    );
  }
  return lines;
}

function renderDataWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = phpStringArray(event.schemaVersionPath);
  const version = phpString(event.version);
  const envelope = phpString(event.envelopeKey);
  const method = event.type;
  const extra: string[] = [];
  if (method === 'track') {
    extra.push(
      `            'event' => ${phpString(event.name ?? event.type)},`,
    );
  } else if (
    (method === 'page' || method === 'screen') &&
    event.name !== undefined &&
    event.name.trim() !== ''
  ) {
    extra.push(`            'name' => ${phpString(event.name)},`);
  }
  const lines = [
    `    public static function ${fn}(Client $client, string $userId, ${typeName} $properties, array $options = []): void`,
    '    {',
    `        [$data, $ctx] = self::withSchemaVersion(self::toMap($properties), ${optionContext()}, ${pathLiteral}, ${version}, ${envelope});`,
    `        $client->${method}([`,
    "            'userId' => $userId,",
    ...extra,
    "            'properties' => $data,",
    "            'context' => $ctx,",
    ...extraMessageFields('            '),
    '        ]);',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    lines.push(
      '',
      `    public static function ${methodName(event.latestAlias)}(Client $client, string $userId, ${typeName} $properties, array $options = []): void`,
      '    {',
      `        self::${fn}($client, $userId, $properties, $options);`,
      '    }',
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
  if (event.type === 'identify') {
    return renderIdentifyWrapper(event);
  }
  return renderDataWrapper(event);
}

export function renderWrappers(events: NormalizedEvent[]): string {
  assertNoCollisions(events, {
    generatedMethodName: methodName,
    generatedTypeName: typeNameFor,
  });
  const body = [
    renderHelpers(),
    ...events.map((e) => renderEventWrappers(e).join('\n')),
  ].join('\n\n');
  return `final class HtEvents\n{\n${body}\n}`;
}
