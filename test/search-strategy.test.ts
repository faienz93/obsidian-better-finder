import { SearchStrategyFactory } from "../src/engine/SearchStrategy";
import { SearchUIHelper } from "../src/SearchUIHelper";

describe('SearchStrategyFactory.parse', () => {
  const factory = SearchStrategyFactory.getInstance();

  it('separates tags, date and free text', () => {
    const parsed = factory.parse('#spring created:today architettura');

    expect(parsed.tags).toEqual(['#spring']);
    expect(parsed.dateFilter).toEqual({ field: 'created', value: 'today' });
    expect(parsed.freeText).toBe('architettura');
  });

  it('does not mistake negations for positive filters', () => {
    // "-image" must not switch on the image filter (a parsing order bug).
    const parsed = factory.parse('spring -image');

    expect(parsed.fileTypes).toHaveLength(0);
    expect(parsed.negations?.extensions).toEqual(expect.arrayContaining(['png']));
    expect(parsed.freeText).toBe('spring');
  });

  it('reads -#tag as a negation, not a searched tag', () => {
    const parsed = factory.parse('#keep -#draft');

    expect(parsed.tags).toEqual(['#keep']);
    expect(parsed.negations?.tags).toEqual(['#draft']);
  });

  it('enters command mode with >', () => {
    const parsed = factory.parse('> toggle');

    expect(parsed.isCommandMode).toBe(true);
  });

  it('reads reserved keys before metadata: created: is not a property', () => {
    const parsed = factory.parse('created:today author:rossi');

    expect(parsed.dateFilter).toEqual({ field: 'created', value: 'today' });
    expect(parsed.metadataFilters).toEqual([{ key: 'author', value: 'rossi' }]);
    expect(parsed.freeText).toBe('');
  });

  it('reads task: followed by the space a hint click adds (B4)', () => {
    const parsed = factory.parse('task: ');

    expect(parsed.taskFilter).toBe('all');
    expect(parsed.freeText).toBe('');
  });
});

describe('SearchUIHelper.toggleDateValue', () => {
  it('sets the value with no space after the colon', () => {
    expect(SearchUIHelper.toggleDateValue('created:', 'today')).toBe('created:today');
    expect(SearchUIHelper.toggleDateValue('created: ', 'today')).toBe('created:today ');
  });

  it('replaces the previous value (mutually exclusive selection)', () => {
    expect(SearchUIHelper.toggleDateValue('created:yesterday', 'today')).toBe('created:today');
  });

  it('removes the active value when clicked again (deselection)', () => {
    expect(SearchUIHelper.toggleDateValue('created:today', 'today')).toBe('created:');
  });

  it('leaves the free text around the token alone', () => {
    expect(SearchUIHelper.toggleDateValue('spring created:today note', 'yesterday'))
      .toBe('spring created:yesterday note');
  });

  it('leaves a query without a date field unchanged', () => {
    expect(SearchUIHelper.toggleDateValue('solo testo', 'today')).toBe('solo testo');
  });
});

describe('SearchUIHelper.toggleFilter', () => {
  it('adds an unlit Filter to the query', () => {
    expect(SearchUIHelper.toggleFilter('note', 'canvas')).toBe('note canvas ');
    expect(SearchUIHelper.toggleFilter('', 'title:')).toBe('title: ');
  });

  it('removes a lit keyword Filter, every time it appears', () => {
    expect(SearchUIHelper.toggleFilter('canvas note canvas', 'canvas')).toBe('note ');
    expect(SearchUIHelper.toggleFilter('canvas ', 'canvas')).toBe('');
  });

  it('removes title: with its value, glued or after a space', () => {
    expect(SearchUIHelper.toggleFilter('title:meeting budget', 'title:')).toBe('budget ');
    expect(SearchUIHelper.toggleFilter('title: meeting budget', 'title:')).toBe('budget ');
    expect(SearchUIHelper.toggleFilter('title: ', 'title:')).toBe('');
  });

  it('removes task: with its value', () => {
    expect(SearchUIHelper.toggleFilter('task:done budget', 'task:')).toBe('budget ');
  });

  it('removes every highlight token from the lit highlight: chip, colour keys and words included', () => {
    expect(SearchUIHelper.toggleFilter('docker highlight-red:kafka highlight-blue:', 'highlight:')).toBe('docker ');
    expect(SearchUIHelper.toggleFilter('highlight-green: kafka docker highlight:', 'highlight:')).toBe('docker ');
  });

  it('lights the highlight: chip for a colour key alone', () => {
    expect(SearchStrategyFactory.getInstance().activeHints('highlight-purple: x').map(h => h.label))
      .toEqual(['highlight:']);
  });

  it('removes every tag, and only tags', () => {
    expect(SearchUIHelper.toggleFilter('#project #work note -#draft', '#')).toBe('note -#draft ');
  });

  it('removes a quoted path value whole', () => {
    expect(SearchUIHelper.toggleFilter('path:"Engineering Wiki" docker', 'path:')).toBe('docker ');
  });

  it('removes a date Filter with its value, and leaves the other date field', () => {
    expect(SearchUIHelper.toggleFilter('created:today modified:yesterday note', 'created:'))
      .toBe('modified:yesterday note ');
    expect(SearchUIHelper.toggleFilter('created: note', 'created:')).toBe('note ');
  });

  it('removes every negation', () => {
    expect(SearchUIHelper.toggleFilter('spring -pdf -#draft', '-')).toBe('spring ');
  });

  it('removes every frontmatter filter from the author: chip', () => {
    expect(SearchUIHelper.toggleFilter('author:rossi status:done note', 'author:')).toBe('note ');
  });

  it('leaves command mode, keeping the text as free text', () => {
    expect(SearchUIHelper.toggleFilter('> toggle theme', '>')).toBe('toggle theme ');
    expect(SearchUIHelper.toggleFilter('>', '>')).toBe('');
  });
});
