import { SearchStrategyFactory } from "../src/engine/SearchStrategy";
import { SearchUIHelper } from "../src/SearchUIHelper";

describe('SearchStrategyFactory.parse', () => {
  const factory = SearchStrategyFactory.getInstance();

  it('separa tag, data e testo libero', () => {
    const parsed = factory.parse('#spring created:today architettura');

    expect(parsed.tags).toEqual(['#spring']);
    expect(parsed.dateFilter).toEqual({ field: 'created', value: 'today' });
    expect(parsed.freeText).toBe('architettura');
  });

  it('le negazioni non vengono scambiate per filtri positivi', () => {
    // "-image" non deve attivare il filtro immagini (bug d\'ordine di parsing)
    const parsed = factory.parse('spring -image');

    expect(parsed.fileTypes).toHaveLength(0);
    expect(parsed.negations?.extensions).toEqual(expect.arrayContaining(['png']));
    expect(parsed.freeText).toBe('spring');
  });

  it('-#tag è una negazione, non un tag cercato', () => {
    const parsed = factory.parse('#keep -#draft');

    expect(parsed.tags).toEqual(['#keep']);
    expect(parsed.negations?.tags).toEqual(['#draft']);
  });

  it('command mode con >', () => {
    const parsed = factory.parse('> toggle');

    expect(parsed.isCommandMode).toBe(true);
  });

  it('metadata dopo le chiavi riservate: created: non è un metadato', () => {
    const parsed = factory.parse('created:today author:rossi');

    expect(parsed.dateFilter).toEqual({ field: 'created', value: 'today' });
    expect(parsed.metadataFilters).toEqual([{ key: 'author', value: 'rossi' }]);
    expect(parsed.freeText).toBe('');
  });

  it('task: con spazio dal click su hint (B4)', () => {
    const parsed = factory.parse('task: ');

    expect(parsed.taskFilter).toBe('all');
    expect(parsed.freeText).toBe('');
  });
});

describe('SearchUIHelper.toggleDateValue', () => {
  it('imposta il valore senza spazio dopo i due punti', () => {
    expect(SearchUIHelper.toggleDateValue('created:', 'today')).toBe('created:today');
    expect(SearchUIHelper.toggleDateValue('created: ', 'today')).toBe('created:today ');
  });

  it('sostituisce il valore precedente (selezione mutuamente esclusiva)', () => {
    expect(SearchUIHelper.toggleDateValue('created:yesterday', 'today')).toBe('created:today');
  });

  it('ricliccando il valore attivo lo rimuove (deselezione)', () => {
    expect(SearchUIHelper.toggleDateValue('created:today', 'today')).toBe('created:');
  });

  it('non tocca il testo libero attorno al token', () => {
    expect(SearchUIHelper.toggleDateValue('spring created:today note', 'yesterday'))
      .toBe('spring created:yesterday note');
  });

  it('senza campo data la query resta invariata', () => {
    expect(SearchUIHelper.toggleDateValue('solo testo', 'today')).toBe('solo testo');
  });
});
