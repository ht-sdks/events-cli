import type { NormalizedEvent } from '../../normalize/types';
import { assertNoCollisions } from '../shared/collisions';
import { methodName, typeNameFor } from './names';

function phpString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
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
    '     * @return mixed',
    '     */',
    '    private static function toValue($value)',
    '    {',
    '        if (is_object($value)) {',
    '            return self::toMap($value);',
    '        }',
    '        if (is_array($value)) {',
    '            $out = [];',
    '            foreach ($value as $k => $v) {',
    '                if ($v === null) {',
    '                    continue;',
    '                }',
    '                $out[$k] = self::toValue($v);',
    '            }',
    '            return $out;',
    '        }',
    '        return $value;',
    '    }',
    '',
    '    /** @param mixed $value',
    '     * @return array<string, mixed>',
    '     */',
    '    private static function toMap($value): array',
    '    {',
    '        // Explicit JSON null is unsendable; omit unset / null fields.',
    '        if ($value === null) {',
    '            return [];',
    '        }',
    '        if (is_array($value)) {',
    '            return self::toValue($value);',
    '        }',
    '        $out = [];',
    '        foreach ((new \\ReflectionObject($value))->getProperties() as $prop) {',
    '            if ($prop->isStatic()) {',
    '                continue;',
    '            }',
    '            $prop->setAccessible(true);',
    '            $val = $prop->getValue($value);',
    '            if ($val === null) {',
    '                continue;',
    '            }',
    '            $key = $prop->getName();',
    "            $doc = $prop->getDocComment() ?: '';",
    '            if (preg_match(\'/@JsonName\\("([^"]+)"\\)/\', $doc, $match) === 1) {',
    '                $key = stripcslashes($match[1]);',
    '            }',
    '            $out[$key] = self::toValue($val);',
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
    "        if ($head === 'context') {",
    '            $ctx = is_array($context) ? $context : [];',
    '            return [$data, self::setAtPath($ctx, $rest, $version)];',
    '        }',
    '        return [$data, $context];',
    '    }',
    '',
    '    /**',
    '     * @param array<string, mixed> $message',
    '     * @param array<string, mixed> $options',
    '     * @param array<string, mixed>|null $context',
    '     * @return array<string, mixed>',
    '     */',
    '    private static function withOptionalFields(array $message, array $options, ?array $context): array',
    '    {',
    "        if (array_key_exists('anonymousId', $options)) {",
    "            $message['anonymousId'] = $options['anonymousId'];",
    '        }',
    "        if (array_key_exists('timestamp', $options)) {",
    "            $message['timestamp'] = $options['timestamp'];",
    '        }',
    "        if (array_key_exists('integrations', $options)) {",
    "            $message['integrations'] = $options['integrations'];",
    '        }',
    '        if ($context !== null) {',
    "            $message['context'] = $context;",
    '        }',
    '        return $message;',
    '    }',
  ].join('\n');
}

function optionContext(): string {
  return "$options['context'] ?? null";
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
    '        $client->alias(self::withOptionalFields([',
    "            'userId' => $userId,",
    "            'previousId' => $previousId,",
    '        ], $options, $ctx));',
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
    '        $client->group(self::withOptionalFields([',
    "            'groupId' => $groupId,",
    "            'userId' => $userId,",
    "            'traits' => $data,",
    '        ], $options, $ctx));',
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
    '        $client->identify(self::withOptionalFields([',
    "            'userId' => $userId,",
    "            'traits' => $data,",
    '        ], $options, $ctx));',
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
    `        $client->${method}(self::withOptionalFields([`,
    "            'userId' => $userId,",
    ...extra,
    "            'properties' => $data,",
    '        ], $options, $ctx));',
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
    ...events.map((event) => renderEventWrappers(event).join('\n')),
  ].join('\n\n');
  return `final class HtEvents\n{\n${body}\n}`;
}
