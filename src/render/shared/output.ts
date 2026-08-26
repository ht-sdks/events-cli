export type ArtifactFile = {
  path: string;
  contents: string;
};

export type RenderedSdk = string | ArtifactFile[];

export function flattenRender(result: RenderedSdk): string {
  if (typeof result === 'string') {
    return result;
  }
  return result
    .map((file) => `=== ${file.path} ===\n${file.contents}`)
    .join('\n\n');
}
