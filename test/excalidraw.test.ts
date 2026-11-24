import { isDrawingDataExposed } from "../src/engine/excalidraw";

const drawing = (beforeDrawing: string, block = 'json') => [
  '---', 'excalidraw-plugin: parsed', '---', '',
  '# Excalidraw Data', '', '## Text Elements', 'Hello ^abc', '',
  beforeDrawing, '',
  // The layout the Excalidraw plugin writes: a blank line between the heading and the fence.
  '## Drawing', '', `\`\`\`${block}`, '{"type":"excalidraw"}', '```', '', '%%', '',
].join('\n');

describe('isDrawingDataExposed', () => {
  it('is false when a %% comment hides the drawing data', () => {
    expect(isDrawingDataExposed(drawing('%%'))).toBe(false);
    expect(isDrawingDataExposed(drawing('%%', 'compressed-json'))).toBe(false);
  });

  it('is true when the opening %% is missing and the data would render as a code block', () => {
    expect(isDrawingDataExposed(drawing(''))).toBe(true);
    expect(isDrawingDataExposed(drawing('', 'compressed-json'))).toBe(true);
  });

  it('counts a %% that a comment already closed', () => {
    expect(isDrawingDataExposed(drawing('%% note %%'))).toBe(true);
  });

  it('is false when the file holds no drawing block', () => {
    expect(isDrawingDataExposed('# Just a note\n\n```json\n{}\n```\n')).toBe(false);
  });
});
