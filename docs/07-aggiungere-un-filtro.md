# Aggiungere un filtro alla query

Serve quando vuoi un nuovo token di query, per esempio `lang:it` o `link:`. Un filtro tocca quattro punti: la classe, `index.ts`, la `strategyMap` della factory e `ParsedQuery`. In `SearchStrategy.ts` va inserito in due sequenze diverse: l'estrazione in `parse()` e l'applicazione in `filter()`. L'esempio da copiare è `PathFilter`, il filtro più piccolo che usa tutti i pezzi.

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

`src/engine/search-filters/PathFilter.ts` righe 5-23

Tre regole che il codice dà per scontate:

1. `filter` con valore vuoto restituisce i file invariati: la factory chiama alcuni filtri anche senza token.
2. `extract` e `removeFrom` devono usare lo stesso pattern. Se `removeFrom` lascia un pezzo del token, quel pezzo finisce nel testo libero e passa dall'indice.
3. La regex tollera lo spazio dopo i due punti (`\s*`). Il click sulla chip inserisce `label` seguito da uno spazio, quindi `path: wiki` deve funzionare come `path:wiki`. `src/FinderModal.ts` righe 105-115

Esiste anche `SearchFilterAsync`, con `filterAsync` al posto di `filter`. `src/engine/search-filters/types.ts` righe 52-59

L'unico filtro asincrono è [`highlight:`](./04-sintassi-query.md#evidenziazioni), che legge il contenuto delle note. La factory lo tiene fuori dalla `strategyMap` e lo chiama a parte in `filterFreeText`, dove sostituisce del tutto la ricerca testuale. Un nuovo filtro che deve leggere i file va trattato allo stesso modo, con codice dedicato nella factory. `src/engine/SearchStrategy.ts` righe 150-154

## Registrarlo nella factory

`SearchStrategyFactory` è il singleton che possiede tutti i filtri. Si ottiene con `SearchStrategyFactory.getInstance()`, mai con `new`. I passi per registrare un filtro:

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

   `src/engine/SearchStrategy.ts` righe 21-38

   La chiave (`'path'`) è quella che usi poi in `getStrategy` e `applyStrategy`. La posizione nella mappa decide solo la posizione della chip nella hint bar, non l'ordine di parsing.
4. **Aggiungi il campo** a `ParsedQuery`, opzionale se il filtro può mancare (come `pathFilter?: string`). `src/engine/search-filters/types.ts` righe 4-18

   La struttura è documentata in [ParsedQuery](./02-flusso-ricerca.md#2-la-query-diventa-una-parsedquery).

**⚠️ Trappola**: dimenticare la `strategyMap` non dà lo stesso errore nei due metodi. `getStrategy`, usato da `parse()`, lancia `Strategy not found`. `applyStrategy`, usato da `filter()`, restituisce i file invariati senza dire niente. Se in `filter()` sbagli la chiave, il filtro non filtra e nessuno se ne accorge. `src/engine/SearchStrategy.ts` righe 104-113

## I due ordini: estrazione e applicazione

I filtri si estraggono in un ordine e si applicano in un altro, ciascuno con un suo motivo.

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

`src/engine/SearchStrategy.ts` righe 62-102 e 178-284

**Estrazione.** Ogni `extract` vede il testo già ripulito da chi lo precede, quindi l'ordine decide chi vince su un token ambiguo. Le negazioni vanno per prime perché `-image` verrebbe preso dal filtro immagini e `-#tag` dal filtro tag. `src/engine/SearchStrategy.ts` righe 211-216

Il blocco per `path:` è il modello da copiare per un nuovo filtro:

```ts
    // 7. Extract path filter (in:cartella)
    const pathStrategy = this.getStrategy('path') as PathFilter;

    result.pathFilter = pathStrategy.extract(remainingText);
    remainingText = pathStrategy.removeFrom(remainingText);
```

`src/engine/SearchStrategy.ts` righe 263-267

**⚠️ Trappola**: un token nella forma `chiave:` va estratto **prima** di [MetadataFilter](./04-sintassi-query.md#metadati-del-frontmatter). Quel filtro sta per ultimo e consuma ogni `parola:valore` rimasto. Se metti `lang:it` dopo, o ti dimentichi di inserirlo in `parse()`, la query non dà errore: `lang:it` diventa un filtro di frontmatter sulla chiave `lang` ed esclude tutte le note che non ce l'hanno. Il pattern è `/(?:^|\s)([a-zA-Z][\w-]*):(\S+)/g`. `src/engine/search-filters/MetadataFilter.ts` righe 10-13

Una parola nuda come `pdf` o `base` ha un problema diverso: se compare nel testo libero diventa un filtro: "base di dati" attiva il filtro `.base`. Preferisci un prefisso con i due punti.

**Applicazione.** Qui l'ordine decide su quale insieme lavora ogni filtro: `path:` sta prima dei tipi file "così lavora su tutti i file". Il nuovo blocco segue la forma degli altri:

```ts
    if (parsed.pathFilter) {
      results = this.applyStrategy('path', results, parsed.pathFilter, app);
    }
```

`src/engine/SearchStrategy.ts` righe 78-81

## Filtri, indice e anteprime

Dopo `filter()` il testo libero passa da `filterFreeText`. La scelta fra [l'indice MiniSearch](./03-flusso-indicizzazione.md#2-lindice-minisearch-si-costruisce-a-blocchi-di-100-note) e il fallback dipende da un solo campo di `ParsedQuery`:

```ts
    const hasExplicitFileTypes = parsed.fileTypes.length > 0;

    // No explicit file type filter: use MiniSearch (markdown + documenti esterni
    // tipo PDF/OCR) + basename search per i file non indicizzati
    if (!hasExplicitFileTypes && searchIndex.isIndexReady()) {
```

`src/engine/SearchStrategy.ts` righe 161-165

**⚠️ Trappola**: se il nuovo filtro scrive in `fileTypes`, l'indice si spegne per tutte le query che lo usano. Il fallback legge il contenuto solo dei `.md`, quindi il testo di PDF e immagini estratto da Xberg non si trova più ([il testo libero passa dall'indice](./02-flusso-ricerca.md#4-il-testo-libero-passa-dallindice)). Un filtro che non riguarda tipi di file usa un campo suo di `ParsedQuery`.

Se il filtro introduce un tipo di file nuovo, anteprima e indicizzazione si aggiornano insieme (`CLAUDE.md` riga 33). I punti da toccare:

- `PREVIEW_EXTENSIONS`, che decide se la riga della modale ha l'anteprima. `src/FinderModal.ts` riga 9
- `ImagePreview`, che sceglie il rendering per estensione. `src/component/ui/ImagePreview.ts` righe 11-75
- `XBERG_EXTENSIONS`, se il testo va estratto dal sidecar. `src/engine/XbergExtractor.ts` righe 6-10

## Hint e sub-hint nella UI

La chip arriva gratis: la hint bar mostra `factory.hints`, cioè le strategy della mappa più `highlight:` in coda. `src/engine/SearchStrategy.ts` righe 40-42

La chip si accende per sottostringa sulla `label` ([barra degli hint](./06-interfaccia.md#la-barra-degli-hint)), quindi scegli una label che non compaia dentro parole comuni.

Se il filtro ha un insieme fisso di valori, come le date, puoi dargli una sub-hint bar. I valori stanno nel filtro e il componente `HintBarSub` li riceve già pronti:

```ts
    this.subHintBar.setContent(
      [...DATE_VALUES, String(new Date().getFullYear())],
      i18n.dateFormatPlaceholder
    );
```

`src/SearchUIHelper.ts` righe 41-44

Oggi la sub-hint bar è una sola e gestisce solo le date. `onInput` la mostra quando c'è `created:` o `modified:`, e `toggleDateValue` sostituisce il valore nella query. Per un secondo filtro con valori servono una seconda istanza e un secondo ramo in `onInput`. `src/SearchUIHelper.ts` righe 66-80

## Testarlo con Jest

I test girano con `npm test` (Jest con ts-jest). `jest.config.js` sostituisce `obsidian` e `minisearch` con dei mock, quindi la logica dei filtri si prova senza Obsidian. `jest.config.js` righe 1-12

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

2. **Test dell'ordine** in `test/search-strategy.test.ts`, sulla `parse()` della factory. Il caso da replicare verifica che una chiave riservata non finisca fra i metadati. Fanne uno con il tuo token accanto a un `author:`. `test/search-strategy.test.ts` righe 37-43
3. **Lancia** `npm test` in locale. Il workflow di CI fa build e lint ma non i test ([job di CI](./05-ci-cd.md#i-job)), quindi un test rotto passa la pipeline. `package.json` riga 14

**⚠️ Trappola**: la factory è un singleton condiviso da tutti i test del file. I pattern con flag `g` di `FileTypeFilter` usano `.test()`, che si ricorda `lastIndex` fra una chiamata e l'altra. Funziona perché `parse()` chiama sempre `removeFrom` subito dopo `extract`. Se il tuo filtro usa una regex globale con `.test()`, due `extract` di fila sulla stessa istanza possono dare un falso negativo. Usa `match` o una regex senza `g`. `src/engine/search-filters/FileTypeFilter.ts` righe 11-17
