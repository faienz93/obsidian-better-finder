/** `text` as a regex source that matches it literally: `c++` or `3.5` stop acting as operators. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
