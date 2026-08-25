import {
  JavaRenderer,
  JavaTargetLanguage,
  KotlinRenderer,
  KotlinTargetLanguage,
  defined,
  getOptionValues,
  javaOptions,
  kotlinOptions,
  type ClassType,
  type LanguageName,
  type Name,
  type RenderContext,
  type RendererOptions,
} from 'quicktype-core';

/**
 * `just-types` skips Jackson/Gson. Subclass the stock renderers so a field
 * keeps its JSON key when the identifier had to change (`order-id` → orderId).
 */
class JsonNameJavaRenderer extends JavaRenderer {
  protected emitClassDefinition(c: ClassType, className: Name): void {
    const imports = [...this.importsForType(c), ...this.importsForClass(c)];
    this.emitFileHeader(className, imports);
    this.emitDescription(this.descriptionForType(c));
    this.emitClassAttributes(c, className);
    this.emitBlock(['public class ', className], () => {
      this.forEachClassProperty(c, 'none', (name, jsonName, p) => {
        if (this.sourcelikeToString(name) !== jsonName) {
          this.emitLine(`@JsonName(${JSON.stringify(jsonName)})`);
        }
        this.emitLine(
          'private ',
          this.javaType(false, p.type, true),
          ' ',
          name,
          ';',
        );
      });
      if (!this._options.lombok) {
        const accessors = (
          this as unknown as {
            _gettersAndSettersForPropertyName: Map<Name, [Name, Name]>;
          }
        )._gettersAndSettersForPropertyName;
        this.forEachClassProperty(
          c,
          'leading-and-interposing',
          (name, jsonName, p) => {
            this.emitDescription(this.descriptionForClassProperty(c, jsonName));
            const [getterName, setterName] = defined(accessors.get(name));
            const rendered = this.javaType(false, p.type);
            this.emitLine(
              'public ',
              rendered,
              ' ',
              getterName,
              '() { return ',
              name,
              '; }',
            );
            this.emitLine(
              'public void ',
              setterName,
              '(',
              rendered,
              ' value) { this.',
              name,
              ' = value; }',
            );
          },
        );
      }
    });
    this.finishFile();
  }
}

export class JsonNameJavaTargetLanguage extends JavaTargetLanguage {
  protected makeRenderer<Lang extends LanguageName = 'java'>(
    renderContext: RenderContext,
    untypedOptionValues: RendererOptions<Lang>,
  ): JavaRenderer {
    return new JsonNameJavaRenderer(
      this,
      renderContext,
      getOptionValues(javaOptions, untypedOptionValues),
    );
  }
}

class JsonNameKotlinRenderer extends KotlinRenderer {
  protected renameAttribute(
    name: Name,
    jsonName: string,
    _required: boolean,
    meta: Array<() => void>,
  ): void {
    if (this.sourcelikeToString(name) !== jsonName) {
      meta.push(() => {
        this.emitLine(`@field:JsonName(${JSON.stringify(jsonName)})`);
      });
    }
  }
}

export class JsonNameKotlinTargetLanguage extends KotlinTargetLanguage {
  protected makeRenderer<Lang extends LanguageName = 'kotlin'>(
    renderContext: RenderContext,
    untypedOptionValues: RendererOptions<Lang>,
  ): KotlinRenderer {
    return new JsonNameKotlinRenderer(
      this,
      renderContext,
      getOptionValues(kotlinOptions, untypedOptionValues),
    );
  }
}
