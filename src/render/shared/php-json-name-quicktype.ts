import {
  PhpRenderer,
  PhpTargetLanguage,
  getOptionValues,
  phpOptions,
  type ClassType,
  type LanguageName,
  type Name,
  type RenderContext,
  type RendererOptions,
} from 'quicktype-core';

/**
 * Stock PHP quicktype is verbose marshaling. Emit public properties only, and
 * keep the original JSON key in `@JsonName` when the identifier had to change.
 */
class JsonNamePhpRenderer extends PhpRenderer {
  protected emitFileHeader(): void {
    // Per-file headers are added by the PHP renderer after splitting classes.
  }

  protected emitClassDefinition(c: ClassType, className: Name): void {
    this.emitDescription(this.descriptionForType(c));
    this.emitBlock(['class ', className], () => {
      this.forEachClassProperty(c, 'none', (name, jsonName) => {
        if (this.sourcelikeToString(name) !== jsonName) {
          this.emitLine(`/** @JsonName(${JSON.stringify(jsonName)}) */`);
        }
        this.emitLine('/** @var mixed */');
        this.emitLine('public $', name, ';');
      });
    });
  }
}

export class JsonNamePhpTargetLanguage extends PhpTargetLanguage {
  protected makeRenderer<Lang extends LanguageName = 'php'>(
    renderContext: RenderContext,
    untypedOptionValues: RendererOptions<Lang>,
  ): PhpRenderer {
    return new JsonNamePhpRenderer(
      this,
      renderContext,
      getOptionValues(phpOptions, untypedOptionValues),
    );
  }
}
