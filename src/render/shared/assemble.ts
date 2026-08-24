/** Stitch non-empty source sections with a trailing newline. */
export function assembleSource(sections: readonly string[]): string {
  return `${sections.filter((section) => section.length > 0).join('\n\n')}\n`;
}
