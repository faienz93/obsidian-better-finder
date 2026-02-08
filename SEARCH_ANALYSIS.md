# Analisi della Ricerca: Problemi Attuali e API Native di Obsidian

## Problemi attuali

### 1. Lettura dei file ad ogni keystroke

```
SearchEngine.ts:35
const content = await this.app.vault.cachedRead(file);
```

Ogni volta che l'utente digita un carattere, `searchFiles()` chiama `cachedRead()` su **ogni file markdown** del vault. Con 500 note vengono eseguite 500 letture per ogni singolo tasto premuto. `cachedRead` è più veloce di `read` (usa una cache OS-level), ma resta una chiamata asincrona per file — il costo si accumula rapidamente.

I file non-markdown (PDF, immagini, canvas, JSON...) non vengono cercati nel contenuto, ma vengono comunque iterati nel loop per il match sul nome.

### 2. Matching a sottostringa semplice — nessun fuzzy search

```
SearchEngine.ts:28
if (file.basename.toLowerCase().includes(searchText))
```

La ricerca usa `String.includes()`: un semplice controllo di sottostringa. Questo significa:
- Nessuna tolleranza per errori di battitura ("obsdan" non trova "obsidian")
- Nessun matching parziale o per iniziali ("sf" non trova "SearchFiles")
- L'utente deve ricordare l'esatta sequenza di caratteri

Lo stesso vale per `searchInTitles()` che usa lo stesso approccio.

### 3. Scoring rudimentale

```
SearchEngine.ts:29   score += 10;           // match nel titolo
SearchEngine.ts:40   score += occurrences;  // numero di occorrenze nel contenuto
```

Il punteggio è molto basico:
- Match nel titolo = +10 punti fissi (non distingue tra match esatto, parziale, all'inizio...)
- Match nel contenuto = +1 per ogni occorrenza (un file con la parola ripetuta 20 volte vale più di un file con un match nel titolo)
- Non c'è modo di sapere _dove_ nel testo avviene il match (nessuna posizione salvata per l'highlight)

### 4. RegExp non escaped nel contenuto

```
SearchEngine.ts:39
const occurrences = (lowerContent.match(new RegExp(searchText, 'g')) || []).length;
```

Il testo dell'utente viene usato direttamente come pattern regex. Se l'utente cerca `file.name` o `(test)`, la regex si rompe o produce risultati inaspettati perché `.`, `(`, `)` sono metacaratteri regex.

### 5. Lista file statica (`allFiles`)

```
FinderCore.ts:25
this.allFiles = app.vault.getFiles();
```

La lista dei file viene popolata **una sola volta** nel constructor di `FinderCore`. Se l'utente crea, rinomina o cancella un file, la lista non si aggiorna — quei file restano invisibili alla ricerca finché non si riapre il finder.

### 6. Bug: l'ordinamento per rilevanza viene sovrascritto

```
FinderCore.ts:136-143  → la ricerca ordina per rilevanza (score)
FinderCore.ts:163      → results.sort((a, b) => b.stat.mtime - a.stat.mtime)  // sovrascrive!
```

Alla riga 163 di `FinderCore.ts`, tutti i risultati vengono ri-ordinati per data di modifica **dopo** che `SearchEngine` li ha già ordinati per rilevanza. Il sort per `mtime` alla riga 143 (dentro il branch `else` quando non c'è testo libero) è corretto, ma quello alla riga 163 è incondizionato e distrugge l'ordinamento per score.

### 7. Ricerca nel contenuto solo per markdown

```
SearchEngine.ts:33
if (file.extension === 'md') {
```

Il plugin gestisce tutti i tipi di file (`vault.getFiles()` restituisce PDF, immagini, JSON, canvas...) ma cerca nel contenuto solo dei `.md`. I file non-markdown possono essere trovati solo per nome. Questo è un limite ragionevole per formati binari (PDF, immagini), ma file di testo come `.json` o `.canvas` potrebbero beneficiare della ricerca nel contenuto.

---

## API native di Obsidian utilizzabili

### `prepareFuzzySearch(query)`

```typescript
import { prepareFuzzySearch } from "obsidian";

const search = prepareFuzzySearch("obsdan");
const result = search("obsidian");
// result = { score: -0.15, matches: [[0,1], [2,4], [5,8]] }
```

**Cosa fa**: crea una funzione di ricerca fuzzy riutilizzabile. Trova match anche con lettere mancanti o nell'ordine sbagliato.

**Vantaggio**: l'utente può digitare "obsdan" e trovare "obsidian", oppure "sf" e trovare "SearchFiles". Restituisce uno `score` (negativo, più vicino a 0 = match migliore) e le posizioni esatte dei caratteri matchati — utilizzabili per l'highlight nella UI.

**Ideale per**: ricerca nei titoli/nomi file (piccolo set di stringhe brevi).

### `prepareSimpleSearch(query)`

```typescript
import { prepareSimpleSearch } from "obsidian";

const search = prepareSimpleSearch("obsidian plugin");
const result = search("This is an Obsidian plugin for search");
// result = { score: -0.1, matches: [[14,22], [23,29]] }
```

**Cosa fa**: crea una funzione di ricerca per parole separate da spazio. Tutte le parole devono essere presenti nel testo (ordine irrilevante).

**Vantaggio**: più performante di `prepareFuzzySearch` su testi lunghi. Obsidian stesso raccomanda questa per la ricerca su grandi quantità di testo. Restituisce score e posizioni match come `prepareFuzzySearch`.

**Ideale per**: ricerca nel contenuto dei file (migliaia di stringhe lunghe).

### `renderMatches(el, text, matches)`

```typescript
import { renderMatches } from "obsidian";

const titleEl = document.createElement("span");
renderMatches(titleEl, "obsidian", result.matches);
// Produce: <span>o<span class="suggestion-highlight">bs</span>id<span class="suggestion-highlight">ian</span></span>
```

**Cosa fa**: renderizza il testo in un elemento HTML evidenziando le porzioni che hanno matchato. Usa la classe CSS `suggestion-highlight` già stilata dal tema di Obsidian.

**Vantaggio**: highlight dei match gratis, coerente con il tema dell'utente, senza scrivere CSS o logica di rendering personalizzata.

### `metadataCache.on('changed', callback)`

```typescript
this.app.metadataCache.on('changed', (file: TFile, data: string, cache: CachedMetadata) => {
  // 'data' è il contenuto testuale del file, già disponibile senza leggere dal disco
  // 'cache' è il metadata indicizzato (headings, tags, links, tasks...)
});
```

**Cosa fa**: viene invocato ogni volta che Obsidian ri-indicizza un file dopo una modifica. Il parametro `data` contiene il contenuto del file, il parametro `cache` contiene il metadata strutturato.

**Vantaggio**: permette di mantenere un indice in memoria aggiornato **senza mai chiamare `cachedRead()`**. Obsidian ci fornisce il contenuto direttamente nel callback. Combinato con un indice iniziale costruito all'avvio, elimina completamente la necessità di leggere file durante la ricerca.

### `vault.on('create' | 'delete' | 'rename')`

```typescript
this.app.vault.on('create', (file) => { /* aggiungere all'indice */ });
this.app.vault.on('delete', (file) => { /* rimuovere dall'indice */ });
this.app.vault.on('rename', (file, oldPath) => { /* aggiornare chiave nell'indice */ });
```

**Cosa fa**: eventi del vault che notificano creazione, cancellazione e rinominazione di file.

**Vantaggio**: combinati con `metadataCache.on('changed')`, permettono di mantenere sia la lista file che l'indice dei contenuti sempre sincronizzati — eliminando il problema di `allFiles` statico. Funzionano per **tutti i tipi di file**, non solo markdown.

### `vault.getFiles()` come lista reattiva

```typescript
const files = this.app.vault.getFiles(); // tutti i file
const mdFiles = this.app.vault.getMarkdownFiles(); // solo .md
```

**Nota**: `vault.getFiles()` restituisce la lista interna di Obsidian, che è **già mantenuta aggiornata** automaticamente. Chiamarlo è economico (non legge il disco). Invece di cachare `allFiles` nel constructor, si può chiamare direttamente ad ogni ricerca.

### `CachedMetadata` — metadata già indicizzato gratuitamente

```typescript
const cache = this.app.metadataCache.getFileCache(file);
// cache.headings  → [{heading: "Titolo", level: 1}, ...]
// cache.tags      → [{tag: "#todo"}, ...]
// cache.links     → [{link: "other-note", displayText: "..."}, ...]
// cache.listItems → [{task: "x"}, {task: " "}, ...]  (checkbox)
// cache.frontmatter → {title: "...", author: "...", ...}
```

**Cosa fa**: Obsidian indicizza automaticamente ogni file markdown e rende disponibile il metadata strutturato senza leggere il file. Già usato nel plugin per tag e task.

**Vantaggio potenziale**: i testi degli heading (`cache.headings[].heading`) possono essere usati come layer di ricerca intermedio — più leggero del contenuto completo, ma più ricco del solo nome file. Utile per un ranking a più livelli: titolo → heading → contenuto.

---

## Riepilogo: Attuale vs Possibile

| Aspetto | Attuale | Con API native |
|---------|---------|----------------|
| Lettura file | `cachedRead()` su ogni file ad ogni keystroke | Indice in memoria, aggiornato via eventi, zero letture durante la ricerca |
| Matching titoli | `includes()` — sottostringa esatta | `prepareFuzzySearch()` — fuzzy, typo-tolerant |
| Matching contenuti | `RegExp` non escaped su testo raw | `prepareSimpleSearch()` — ricerca per parole, performante |
| Scoring | +10 titolo, +1 per occorrenza | Score nativo di Obsidian (posizionale, pesato) |
| Highlight | Nessuno | `renderMatches()` — coerente col tema |
| Lista file | Statica, mai aggiornata | `vault.getFiles()` diretto oppure eventi vault |
| Ordinamento | Bug: mtime sovrascrive rilevanza | Sort per score solo quando c'è freeText |
| File non-md | Solo match sul nome | Match sul nome con fuzzy + eventi vault per sync |
