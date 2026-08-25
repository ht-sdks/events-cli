import {
  CSharpTargetLanguage,
  SystemTextJsonCSharpRenderer,
  getOptionValues,
  systemTextJsonCSharpOptions,
  type ClassProperty,
  type ClassType,
  type LanguageName,
  type Name,
  type RenderContext,
  type RendererOptions,
  type Sourcelike,
} from 'quicktype-core';

/**
 * `just-types` skips System.Text.Json attributes. Emit `[JsonPropertyName]`
 * when the identifier had to change so ToMap can restore the contract key.
 */
class JsonNameCSharpRenderer extends SystemTextJsonCSharpRenderer {
  protected attributesForProperty(
    _property: ClassProperty,
    name: Name,
    _c: ClassType,
    jsonName: string,
  ): Sourcelike[] | undefined {
    if (this.sourcelikeToString(name) !== jsonName) {
      return [`[JsonPropertyName(${JSON.stringify(jsonName)})]`];
    }
    return undefined;
  }
}

export class JsonNameCSharpTargetLanguage extends CSharpTargetLanguage {
  protected makeRenderer<Lang extends LanguageName = 'csharp'>(
    renderContext: RenderContext,
    untypedOptionValues: RendererOptions<Lang>,
  ): SystemTextJsonCSharpRenderer {
    return new JsonNameCSharpRenderer(
      this,
      renderContext,
      getOptionValues(systemTextJsonCSharpOptions, untypedOptionValues),
    );
  }
}
