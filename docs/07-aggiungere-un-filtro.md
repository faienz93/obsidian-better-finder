# Aggiungere un filtro alla query

Serve quando vuoi un nuovo token di query, per esempio `lang:it` o `link:`. Un filtro tocca quattro punti: la classe, `index.ts`, la `strategyMap` della factory e `ParsedQuery`. In `SearchStrategy.ts` va inserito in due sequenze diverse, l'estrazione in `parse()` e l'applicazione in `filter()`. L'esempio da copiare è `PathFilter`, il filtro più piccolo che usa tutti i pezzi.

## Anatomia di un filtro

Un filtro è una sottoclasse di `SearchFilter<T>`, dove `T` è quello che il filtro estrae dalla query. La classe tiene insieme parsing e filtraggio dello stesso token:

```ts
export abstract class SearchFilter<TResult> implements SearchStrategyInterface<TResult>, Filterable<TResult>, HintsType {
  abstract readonly label: string;
  abstract readonly desc: string;
  abstract filter(files: TFile[], extracted: TResult, app: App): TFile[]

  abstract extract(query: string): TResult
  abstract removeFrom(query: string): string
}
```

`src/engine/search-filters/types.ts` righe 39-46

| Membro | Cosa fa | Chi lo usa |
|---|---|---|
| `label` | testo della chip nella hint bar e testo inserito al click | `HintBar`, `Finder.getActiveHints` |
| `desc` | tooltip della chip | `HintBar` |
| `extract(query)` | legge il token dal testo e restituisce `T` | `parse()` |
| `removeFrom(query)` | toglie il token e restituisce il testo rimasto | `parse()` |
| `filter(files, T, app)` | riduce la lista dei file | `filter()` della factory |

`PathFilter` è il caso minimo:

```ts
export class PathFilter extends SearchFilter<string | undefined> {
  readonly label = 'path:';
  readonly desc = i18n.path;

  extract(query: string): string | undefined {
    const match = query.match(/\bpath:\s*(\S+)/i);

    return match ? match[1].toLowerCase() : undefined;
  }

  removeFrom(query: string): string {
    return query.replace(/\bpath:\s*\S+/i, '').trim();
  }

  filter(files: TFile[], extracted: string | undefined, _app: App): TFile[] {
    if (!extracted) return files;

    return files.filter(f => (f.parent?.path ?? '').toLowerCase().includes(extracted));
  }
}
```

`src/engine/search-filters/PathFilter.ts` righe 5-24

Tre regole che il codice dà per scontate:

1. `filter` con valore vuoto restituisce i file invariati: la factory chiama alcuni filtri anche senza token.
2. `extract` e `removeFrom` usano lo stesso pattern, altrimenti un pezzo del token finisce nel testo libero e passa dall'indice.
3. La regex tollera lo spazio dopo i due punti (`\s*`). Il click sulla chip inserisce `label` seguito da uno spazio, quindi `path: wiki` deve funzionare come `path:wiki`. `src/FinderModal.ts` righe 81-91

Un filtro che deve leggere i file estende invece `SearchFilterAsync`, con `filterAsync`. L'unico esempio è [`highlight:`](./04-sintassi-query.md#evidenziazioni): la factory lo tiene fuori dalla `strategyMap` e lo chiama a parte in `filterFreeText`, al posto della ricerca testuale. `src/engine/search-filters/types.ts` righe 52-59 e `src/engine/SearchStrategy.ts` righe 156-160

## Registrarlo nella factory

`SearchStrategyFactory` è il singleton che possiede tutti i filtri. Si ottiene con `SearchStrategyFactory.getInstance()`, mai con `new`. Per registrare un filtro:

1. **Esporta la classe** da `src/engine/search-filters/index.ts`, accanto alle altre. `src/engine/search-filters/index.ts` righe 5-16
2. **Importala** nel blocco di import di `src/engine/SearchStrategy.ts`. `src/engine/SearchStrategy.ts` righe 4-10
3. **Aggiungila alla `strategyMap`** nel costruttore privato:

   ```ts
   private constructor() {
     // L'ordine definisce l'ordine degli hints nella UI
     this.strategyMap.set('tag', new TagsFilter());
     // ...
     this.strategyMap.set('path', new PathFilter());
     this.strategyMap.set('excalidraw', new ExcalidrawFilter());
     this.strategyMap.set('not', new NegationFilter());
     this.strategyMap.set('meta', new MetadataFilter());
   }
   ```

   `src/engine/SearchStrategy.ts` righe 27-44

   La chiave (`'path'`) è quella di `getStrategy` e `applyStrategy`. La posizione nella mappa decide solo la chip nella hint bar.
4. **Aggiungi il campo** a `ParsedQuery`, opzionale se il filtro può mancare (come `pathFilter?: string`). `src/engine/search-filters/types.ts` righe 4-18

   La struttura è documentata in [ParsedQuery](./02-flusso-ricerca.md#2-la-query-diventa-una-parsedquery).

**⚠️ Trappola**: dimenticare la `strategyMap` non dà lo stesso errore nei due metodi. `getStrategy`, usato da `parse()`, lancia `Strategy not found`. `applyStrategy`, usato da `filter()`, restituisce i file invariati senza dire niente, quindi con una chiave sbagliata in `filter()` il filtro non filtra e nessuno se ne accorge. `src/engine/SearchStrategy.ts` righe 58-66 e 110-119

## I due ordini: estrazione e applicazione

I filtri si estraggono in un ordine e si applicano in un altro, ciascuno con il suo motivo.

| # | Estrazione in `parse()` | Applicazione in `filter()` |
|---|---|---|
| 1 | `>` comando (esce subito) | esclusione `#archive` |
| 2 | negazioni `-` | `#tag` |
| 3 | `#tag` | `created:` / `modified:` |
| 4 | `modified:` poi `created:` | `path:` |
| 5 | tipi file, poi `excalidraw` | tipi file ed `excalidraw` |
| 6 | `title:` | metadati |
| 7 | `task:` | negazioni |
| 8 | `path:` | `task:` |
| 9 | `highlight:` | scope `title:` |
| 10 | metadati `chiave:valore` | |
| 11 | il resto è `freeText` | |

`src/engine/SearchStrategy.ts` righe 68-105 e 190-296

**Estrazione.** Ogni `extract` vede il testo già ripulito dai precedenti, quindi l'ordine decide chi vince su un token ambiguo. Le negazioni vanno per prime: altrimenti `-image` lo prenderebbe il filtro immagini e `-#tag` il filtro tag. `src/engine/SearchStrategy.ts` righe 223-228

Il blocco per `path:` è il modello da copiare:

```ts
    // 7. Extract path filter (in:cartella)
    const pathStrategy = this.getStrategy('path') as PathFilter;

    result.pathFilter = pathStrategy.extract(remainingText);
    remainingText = pathStrategy.removeFrom(remainingText);
```

`src/engine/SearchStrategy.ts` righe 275-279

**⚠️ Trappola**: un token nella forma `chiave:` va estratto **prima** di [MetadataFilter](./04-sintassi-query.md#metadati-del-frontmatter). Quel filtro sta per ultimo e consuma ogni `parola:valore` rimasto. Se metti `lang:it` dopo, o ti dimentichi di inserirlo in `parse()`, la query non dà errore: `lang:it` diventa un filtro di frontmatter sulla chiave `lang` ed esclude tutte le note che non ce l'hanno. Il pattern è `/(?:^|\s)([a-zA-Z][\w-]*):(\S+)/g`. `src/engine/search-filters/MetadataFilter.ts` righe 10-13

Una parola nuda come `base` diventa un filtro anche nel testo libero ("base di dati" attiva `.base`): preferisci un prefisso con i due punti.

**Applicazione.** Qui l'ordine decide su quale insieme lavora ogni filtro: `path:` sta prima dei tipi file perché lavori su tutti i file. Il nuovo blocco segue la forma degli altri:

```ts
    if (parsed.pathFilter) {
      results = this.applyStrategy('path', results, parsed.pathFilter, app);
    }
```

`src/engine/SearchStrategy.ts` righe 84-87

## Filtri, indice e anteprime

Dopo `filter()` il testo libero passa da `filterFreeText`. La scelta fra [l'indice MiniSearch](./03-flusso-indicizzazione.md#2-lindex-minisearch-si-costruisce-a-blocchi-di-100-note) e la lettura diretta dei file dipende da un solo campo di `ParsedQuery`:

```ts
    const hasExplicitFileTypes = parsed.fileTypes.length > 0;
    // ...
    if (!hasExplicitFileTypes && searchIndex.isIndexReady()) {
```

`src/engine/SearchStrategy.ts` righe 167-172

**⚠️ Trappola**: se il nuovo filtro scrive in `fileTypes`, l'indice si spegne per le query che lo usano e il testo di PDF e immagini non si trova più ([dettagli](./02-flusso-ricerca.md#4-il-testo-libero-passa-dallindex)). Un filtro che non riguarda tipi di file usa un campo suo di `ParsedQuery`.

Se il filtro introduce un tipo di file nuovo, anteprima e indicizzazione si aggiornano insieme (regola di `CLAUDE.md`). I punti da toccare:

- `ImagePreview.hasPreview` e `EMBED_EXTENSIONS`, la sola risposta a "questo file ha un'anteprima?", più `ImagePreview.load` per il rendering. `src/component/ui/ImagePreview.ts` righe 11-28
- `XBERG_EXTENSIONS`, se il testo va estratto dal sidecar. `src/engine/XbergExtractor.ts` righe 6-11

## Se il filtro cambia cosa mostra un risultato

Un filtro che decide anche come si disegna una riga (come i tag o `task:`) va riflesso in `buildResultData`, che costruisce la Data di ogni risultato per Modal e Moodboard e legge `parsed`. `src/engine/ResultData.ts` righe 27-44

Due vincoli:

- I tag di un file si leggono con `getFileTags`, mai da `metadataCache`: per i canvas passa dalla cache dei tag. `src/engine/fileTags.ts` righe 8-16
- `buildResultData` legge solo metadati in cache, non il contenuto dei file. `src/engine/ResultData.ts` riga 26

`test/result-data.test.ts` lo prova con la ricerca vera e un vault finto. `test/result-data.test.ts` righe 38-50

## Hint e sub-hint nella UI

La chip arriva gratis: la hint bar mostra `factory.hints`, cioè le strategy della mappa più `highlight:` in coda. `src/engine/SearchStrategy.ts` righe 46-48

La chip si accende per sottostringa sulla `label` ([barra degli hint](./06-interfaccia.md#la-barra-degli-hint)): scegline una che non compaia in parole comuni. `src/Finder.ts` righe 66-72

Se il filtro ha un insieme fisso di valori, come le date, puoi dargli una sub-hint bar. I valori stanno nel filtro e il componente `HintBarSub` li riceve già pronti:

```ts
    this.subHintBar.setContent(
      [...DATE_VALUES, String(new Date().getFullYear())],
      i18n.dateFormatPlaceholder
    );
```

`src/SearchUIHelper.ts` righe 41-44

Oggi la sub-hint bar è una sola e serve solo le date: `onInput` la mostra con `created:` o `modified:`. Per un secondo filtro con valori servono una seconda istanza e un secondo ramo in `onInput`. `src/SearchUIHelper.ts` righe 66-80

## Testarlo con Jest

I test girano con `npm test` (Jest con ts-jest). `jest.config.js` sostituisce `obsidian` e `minisearch` con dei mock: la logica dei filtri si prova senza Obsidian. `jest.config.js` righe 1-12

1. **Test del filtro** in `test/search-filters.test.ts`. Usa gli helper `fakeFile` e `fakeApp`: il secondo costruisce una `metadataCache` finta per path. `test/search-filters.test.ts` righe 12-25

   Un caso di `extract` ha questa forma:

   ```ts
   describe('MetadataFilter', () => {
     const filter = new MetadataFilter();

     it('estrae coppie key:value', () => {
       expect(filter.extract('author:Rossi status:draft')).toEqual([
         { key: 'author', value: 'rossi' },
         { key: 'status', value: 'draft' },
       ]);
     });
   ```

   `test/search-filters.test.ts` righe 140-148

2. **Test dell'ordine** in `test/search-strategy.test.ts`, sulla `parse()` della factory: il caso da replicare verifica che una chiave riservata non finisca fra i metadati, e il tuo ne mette il token accanto a un `author:`. `test/search-strategy.test.ts` righe 37-43
3. **Lancia** `npm test` in locale. Il workflow di CI fa build e lint ma non i test ([job di CI](./05-ci-cd.md#i-job)), quindi un test rotto passa la pipeline. `package.json` riga 14

`test/mocks/minisearch.ts` è uno stub: per l'indice vero serve il `jest.mock` di `test/search-outcome.test.ts` righe 7-11. I singleton si resettano azzerando il campo statico privato, come in `test/common-cache.test.ts` righe 47-48.

**⚠️ Trappola**: la factory è un singleton condiviso da tutti i test del file. I pattern con flag `g` di `FileTypeFilter` usano `.test()`, che si ricorda `lastIndex` fra una chiamata e l'altra. Funziona perché `parse()` chiama `removeFrom` subito dopo `extract`; con due `extract` di fila sulla stessa istanza si avrebbe un falso negativo. Usa `match` o una regex senza `g`. `src/engine/search-filters/FileTypeFilter.ts` righe 11-17
