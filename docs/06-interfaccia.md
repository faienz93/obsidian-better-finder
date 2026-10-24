# Interfaccia: il Modal e la Moodboard

Il plugin ha due interfacce sopra lo stesso motore di ricerca: il **Modal**, un popup guidato da tastiera, e la **Moodboard**, una vista che si apre come tab del workspace con i risultati a griglia o a lista. Il percorso di una query fino al risultato è in [02-flusso-ricerca.md](./02-flusso-ricerca.md).

## Come è organizzata l'interfaccia

Il DOM è costruito a mano, senza framework UI. Il Modal è una `SuggestModal` e la Moodboard una `ItemView`, le classi base di Obsidian per un popup di suggerimenti e per un pannello del workspace: non serve un router.

| Cosa | Dove |
|---|---|
| Modal | `src/FinderModal.ts`, righe in `src/component/Modal/` |
| Moodboard | `src/FinderMoodboard.ts`, Card e righe in `src/component/Card/` |
| Hint bar condivisa | `src/SearchUIHelper.ts` |
| Componenti piccoli (titolo, tag, Body, Preview) | `src/component/ui/` |
| Data di un risultato | `src/engine/ResultData.ts` |
| Stringhe UI in italiano | `i18n` in `src/const.ts` |

Il CSS sta accanto al componente e finisce in [styles.css](./05-ci-cd.md#la-build). Le regole del Modal sono limitate alla classe `better-finder-modal`, che aggiunge `onOpen`. `src/FinderModal.ts` righe 28-30

Le due viste condividono `Finder`, l'hint bar, `buildResultData` e `ModalItem`.

```mermaid
graph TD
  main["main.ts<br/>comandi, ribbon, registerView"]
  Modal["FinderModal<br/>SuggestModal da tastiera"]
  View["FinderMoodboard<br/>ItemView better-finder-view"]
  Finder["Finder<br/>search, openResult, exportResults"]
  Helper["SearchUIHelper<br/>hint, tag, sub-hint date"]
  Build["buildResultData<br/>decide la Data"]
  ModalUI["ModalUI<br/>riga del Modal"]
  ModalItem["ModalItem<br/>builder DOM della riga"]
  CardUI["CardUI<br/>contenitore griglia o lista"]
  Grid["GridCard<br/>Card a griglia"]
  List["ListCard<br/>Item a lista"]
  Hist["SearchHistory<br/>ultime 20 query"]

  main -->|"comando open-modal"| Modal
  main -->|"registerView, ribbon"| View
  Modal -->|"search, openResult"| Finder
  View -->|"search, openResult, exportResults"| Finder
  Modal -->|"monta sotto l'input"| Helper
  View -->|"monta nell'header"| Helper
  Modal -->|"Data per riga"| Build
  View -->|"Data per risultato"| Build
  Modal -->|"render(Data)"| ModalUI
  ModalUI -->|"costruisce la riga"| ModalItem
  View -->|"render(Data)"| CardUI
  CardUI -->|"modo grid"| Grid
  CardUI -->|"modo list"| List
  List -->|"riusa"| ModalItem
  Modal -->|"add alla scelta"| Hist
  View -->|"add al click, getAll con le frecce"| Hist
```

## Come si aprono

`main.ts` registra la vista e due [comandi](./04-sintassi-query.md#comandi-del-plugin): uno apre un Modal, l'altro la Moodboard, come l'icona nel ribbon se [`showRibbonIcon`](./04-sintassi-query.md#impostazioni) è attivo. `main.ts` righe 45-66

`activateFinderView` riusa la prima leaf (un pannello del workspace) che mostra già la vista, quindi la Moodboard è una sola per workspace. Ogni apertura del Modal crea invece un `FinderModal` e un `Finder` nuovi. `main.ts` righe 170-180

## Il Modal

`FinderModal` estende `SuggestModal`: Obsidian gestisce input, lista e tastiera, il plugin fornisce risultati, righe e azione alla scelta.

```
+---------------------------------------------+
| [ input della query                       ] |
| #  created:  modified:  >  title:  pdf ...  |  hint bar
| #spring  #java/jvm                          |  autocomplete tag
| today  yesterday ...  2026  YYYY/MM/DD      |  sub-hint date
+---------------------------------------------+
| Titolo [PDF]  data  cartella   | Preview    |
| Body (Occurrences o task)  #tag   2/5       |
+---------------------------------------------+
```

| Zona | Dove vive nel codice |
|---|---|
| Guscio, input e lista | `SuggestModal` di Obsidian; `getSuggestions` passa la query a `LatestSearch`, tiene l'esito e azzera il Body, `src/FinderModal.ts` righe 56-62 |
| Hint bar, autocomplete tag, sub-hint date | `SearchUIHelper` inserito dopo `.prompt-input-container`, `src/FinderModal.ts` righe 28-46 |
| Riga di risultato | `renderResult` chiama `buildResultData` e `ModalUI.render`, `src/FinderModal.ts` righe 77-89; `src/component/Modal/ModalUI.ts` righe 16-36 |
| Colonna Preview | `ModalItem.setPreview` sposta il contenuto in un wrapper di testo e restituisce la colonna a destra, che il [Body](#body-occurrences-e-preview) riempie, `src/component/Modal/ModalItem.ts` righe 66-78 |
| Riga di comando (query con `>`) | `Finder.renderCommand`, nome, id e hotkey, `src/Finder.ts` righe 120-140 |
| Scelta | `onChooseSuggestion` salva la query in cronologia e apre il risultato, `src/FinderModal.ts` righe 72-75 |

Le righe si disegnano dall'esito della ricerca chiusa, non dall'input (vedi [LatestSearch](./02-flusso-ricerca.md#1-digiti-e-parte-solo-lultima-ricerca)). `src/FinderModal.ts` righe 15-16

Un click su una chip aggiunge l'etichetta alla query e rilancia un evento `input`, così `SuggestModal` ricalcola da sola. `src/FinderModal.ts` righe 91-107

## La Moodboard

`FinderMoodboard` è una `ItemView` con griglia o lista, scroll infinito, cronologia con le frecce, export e menu contestuale. Con `navigation = true`, aprendo un file nella stessa leaf il pulsante indietro di Obsidian riporta alla Moodboard. `src/FinderMoodboard.ts` righe 27-34

```
+------------------------------------------------+
| [ Search files... ]  12 risultati  [lista] [⤓] |  SearchBar
| #  created:  modified:  >  title:  ...         |  hint bar e sub-hint
+------------------------------------------------+
| +-----------+ +-----------+ +-----------+      |
| | Titolo    | | Titolo    | | Titolo    |      |  Card in griglia
| | Preview   | | Preview   | | Preview   |      |
| | data #tag | | data #tag | | data #tag |      |
| +-----------+ +-----------+ +-----------+      |
|            ... sentinella dello scroll ...     |
+------------------------------------------------+
```

| Zona | Dove vive nel codice |
|---|---|
| Header: input, contatore, toggle, export | `SearchBar`, `src/component/ui/SearchBar.ts` righe 11-67; montato da `buildUI`, `src/FinderMoodboard.ts` righe 60-83 |
| Toggle griglia o lista | `ToggleButton`, `src/component/ui/ToggleButton.ts`; lo ascolta `CardUI`, `src/component/Card/CardUI.ts` righe 24-28 |
| Card a griglia | `GridCard`, stili in linea, `src/component/Card/GridCard.ts` righe 20-49 |
| Item a lista | `ListCard`, riusa il `ModalItem` e il [Body](#body-occurrences-e-preview) del Modal, `src/component/Card/ListCard.ts` righe 22-42 |
| Data di una Card | `buildResultData`, chiamata in `renderResult`, `src/FinderMoodboard.ts` righe 149-168 |
| Menu contestuale | evento nativo `file-menu`, lo stesso menu dell'esplora file, `src/FinderMoodboard.ts` righe 170-176 |

**⚠️ Trappola**: la Moodboard si apre vuota, perché `onOpen` costruisce la UI senza lanciare una ricerca. `src/FinderMoodboard.ts` righe 48-50

`FINDER_VIEW_TYPE` (`"better-finder-view"`) è salvato nei layout del workspace: non cambiarlo mai. `src/FinderMoodboard.ts` riga 11

### Scroll infinito

I risultati non hanno un tetto: la vista li tiene tutti e ne disegna 20 alla volta. In fondo all'ultimo blocco mette una sentinella osservata da un `IntersectionObserver` (l'API del browser che avvisa quando un elemento entra nell'area visibile), e quando si vede parte il blocco successivo. Ogni nuova ricerca stacca l'observer e riparte da zero. `src/FinderMoodboard.ts` righe 117-147

**⚠️ Trappola**: `attachSentinel` crea un `IntersectionObserver` a ogni blocco senza disconnettere il precedente. `this.observer` viene sovrascritto, quindi `destroyObserver`, alla ricerca successiva o alla chiusura, disconnette solo l'ultimo: i precedenti restano su una sentinella già rimossa dal DOM e non vengono mai liberati. `src/FinderMoodboard.ts` righe 178-186 e 202-207

### Export dei risultati

Il pulsante ⤓ esporta **tutti** i risultati, anche quelli che lo scroll non ha ancora disegnato: `Finder.exportResults` crea nella radice del vault una nota `Risultati ricerca <timestamp>.md` con query, conteggio e un wikilink per file, poi la apre. I comandi sono esclusi. `src/Finder.ts` righe 147-175

**⚠️ Trappola**: l'ora nel nome del file è in UTC. Il nome viene da `now.toISOString()`, mentre la riga della query dentro la nota usa `toLocaleString()`: a Roma in estate una ricerca delle 15:30 produce `Risultati ricerca 2026-07-14-13-30-00.md`. `src/Finder.ts` righe 161-165

### Differenze dal Modal

- Cronologia con le frecce, export e menu contestuale esistono solo qui.
- Il toggle griglia/lista non ridisegna: `CardUI` cambia classi CSS e `mode` per le Card future, quindi fino alla ricerca successiva convivono Card e Item. `src/component/Card/CardUI.ts` righe 24-28
- In [command mode](./04-sintassi-query.md#comandi-obsidian) i comandi compaiono ma non si lanciano: `renderResult` li disegna senza listener di click. `src/FinderMoodboard.ts` righe 149-167

## La Data di un risultato

La Data è quello che si decide di un risultato per mostrarlo: tag, quali la query ha chiesto, conteggio dei task, cosa va nel Body. Si calcola una volta per risultato dall'intera query, in `buildResultData`, ed è la stessa per Modal e Moodboard. Prima ogni vista aveva le sue regole, che divergevano su tag cercati, tag dei canvas e conteggio dei task. `src/engine/ResultData.ts` righe 10-53

```typescript
// A drawing's text is its encoded scene: it shows its Preview, never Occurrences.
const isNote = file.extension.toLowerCase() === 'md' && !isExcalidraw(app, file);
const snippetWords = isNote ? outcome.matchedWords.get(file.path) ?? [] : [];
const tasks = parsed.taskFilter ? tasksOf(app, file) : [];
const taskLines = isNote && parsed.taskFilter ? pickTaskLines(tasks, parsed.taskFilter) : [];
```

`src/engine/ResultData.ts` righe 38-42

I renderer (`ModalUI`, `GridCard`, `ListCard`, `Tags`) disegnano solo ciò che trovano nella Data, senza rami per tipo di file:

- `tags` sono quelli del file come salvati; `searchedTags` quelli chiesti dalla query, annidati compresi (`#project` evidenzia `#project/alpha`).
- `taskInfo` c'è solo con un filtro [task:](./04-sintassi-query.md#task), in entrambe le viste.
- `snippetWords` sono le parole che la ricerca ha accettato per quel file (`matchedWords` dell'esito): con un errore di battitura o un prefisso, la parola intera del documento. `taskLines` sono le righe dei task nello stato chiesto da `task:`, `task-todo:` o `task-done:`. Entrambe valgono solo per le note `.md` che non sono disegni Excalidraw.
- `renderPreview` è falso per una nota che ha parole o righe di task da mostrare.
- `buildResultData` non legge mai il contenuto dei file, solo i metadati e la [cache dei tag dei canvas](./03-flusso-indicizzazione.md#3-i-tag-dei-canvas-vanno-in-cache).

## Body, Occurrences e Preview

Il **Body** è la parte di un Item sotto il titolo. Mostra quello che la Data ha scelto: le **Occurrences**, le righe dei task, la **Preview** o niente. Le Occurrences sono ogni punto in cui compare una parola cercata, con un po' di contesto; la Preview mostra cosa è il file. Lo disegna un solo componente, `Body`, sia nel Modal sia nella Moodboard a lista. `src/component/ui/Body.ts` righe 13-35

Il Body legge il file solo quando l'Item entra nell'area visibile. `VisibilityWatcher` tiene un solo `IntersectionObserver` per vista e chiama la callback la prima volta che un elemento si vede; `Body.reset()` lo azzera prima di ogni nuova lista di risultati e alla chiusura. Vale anche per la Preview. `src/component/ui/VisibilityWatcher.ts` righe 1-15; `src/FinderModal.ts` righe 56-62

Cosa mostrare lo decide l'engine, in una funzione pura: `bodyText` riceve il contenuto, le parole e le righe dei task, e restituisce passaggi e task pronti da disegnare. `src/engine/occurrences.ts` righe 46-66

| Regola | Valore |
|---|---|
| Parole | ognuna cercata da sola, senza distinzione di maiuscole; la più lunga vince sul suo prefisso |
| Contesto | 5 parole per lato (`OCCURRENCE_CONTEXT_WORDS`), tagliate ai confini di parola e mai oltre la riga |
| Passaggi vicini | si fondono quando fra i due contesti non resta nessuna parola |
| Task | i primi 3 (`MAX_TASK_LINES`) più `+N`; una riga di task mostrata non torna fra le Occurrences |

Nell'Item i passaggi stanno in un riquadro alto due righe. Il Body conta quelli che iniziano sotto il riquadro e li riassume in un `+N`. `src/component/ui/Body.ts` righe 58-79

`ImagePreview.hasPreview` è l'unica risposta a "questo file ha una Preview?", accanto ai rami di `load`:

| Tipo di file | Preview | Dove |
|---|---|---|
| `.md` senza parole né task da mostrare | primi 500 caratteri senza frontmatter, resi come markdown | `src/component/ui/ImagePreview.ts` righe 37-44 |
| `.md` Excalidraw (`excalidraw-plugin: parsed`) | embed `![[...]]`, anche se trovato per testo | `src/engine/excalidraw.ts` righe 3-6; `src/component/ui/ImagePreview.ts` riga 61 |
| png, jpg, jpeg, gif, webp, canvas, pdf | embed `![[...]]` | `src/component/ui/ImagePreview.ts` righe 12 e 61 |
| `.json` | primi 300 caratteri come codice | `src/component/ui/ImagePreview.ts` righe 46-53 |
| docx, xlsx | icona, estensione e fino a 200 caratteri estratti da [Xberg](./03-flusso-indicizzazione.md#4-xberg-estrae-il-testo-di-pdf-immagini-e-office) | `src/component/ui/ImagePreview.ts` righe 72-85 |

**⚠️ Trappola**: le Card della griglia non hanno ancora il Body. Una nota trovata per testo libero o con `task:` ha `renderPreview` falso e `GridCard` non disegna altro, quindi la Card resta vuota fino all'issue #6. `src/component/Card/GridCard.ts` righe 20-49

**⚠️ Trappola**: una nota trovata solo per il titolo ha `snippetWords` ma nessuna Occurrence nel contenuto, e il Body resta vuoto. `src/engine/ResultData.ts` righe 40 e 49

**⚠️ Trappola**: ogni Preview markdown fa girare i post-processor degli altri plugin, ed è la causa sospetta del freeze della Moodboard (nota in `.claude/skills/knowledge-memory/memories/2026-10-18-freeze-moodboard.md`). Il Modal ora ha un suo `Component`, caricato in `onOpen` e scaricato in `onClose`. `src/component/ui/ImagePreview.ts` riga 41; `src/FinderModal.ts` righe 17-18 e 48-54

`CONTEXT.md` descrive un pulsante sulla Card per passare dalle Occurrences alla Preview: non c'è ancora (issue #7).

## Cronologia delle ricerche

`SearchHistory` tiene le ultime 20 query che hanno portato ad aprire un risultato. Una query ripetuta risale in cima e una vuota non entra. Il singleton non sa dove salvare, quindi `main.ts` gli passa all'avvio le voci di `data.json` e una callback che riscrive le [impostazioni](./04-sintassi-query.md#impostazioni). `src/engine/SearchHistory.ts` righe 21-34

```typescript
SearchHistory.getInstance().init(this.settings.searchHistory, (entries) => {
  this.settings.searchHistory = entries;
  this.saveSettings().catch(console.error);
});
```

`main.ts` righe 39-42

Entrambe le viste scrivono (il Modal in `onChooseSuggestion`, la Moodboard al click su una Card), ma solo la Moodboard legge. Qui le frecce scorrono la cronologia come in un terminale: `historyIndex` parte da -1, su va verso le query più vecchie, giù torna all'input vuoto. `src/FinderMoodboard.ts` righe 86-104

Il valore richiamato passa da `SearchBar.setValue`, che lancia un `input` sintetico; il listener usa `event.isTrusted` per azzerare `historyIndex` solo con la digitazione vera. `src/FinderMoodboard.ts` righe 74-81

Nel Modal la cronologia non si sfoglia: `FinderModal` non intercetta le frecce e `getAll` lo chiama solo la Moodboard. `src/FinderModal.ts` righe 28-46

## La barra degli hint

`SearchUIHelper` monta nello stesso contenitore tre pezzi, nell'ordine in cui compaiono:

1. `HintBar`: una chip per filtro, con la `label` come testo e la `desc` come tooltip, nell'ordine di registrazione dei filtri.
2. `TagsPreview`: mentre scrivi un [#tag](./04-sintassi-query.md#tag), mostra i primi 20 tag del vault che iniziano così, ordinati per frequenza.
3. `HintBarSub`: i valori di [created: e modified:](./04-sintassi-query.md#date) più l'anno corrente, visibili solo quando la query contiene uno dei due prefissi.

`src/SearchUIHelper.ts` righe 28-45

`HintBarSub` riceve i valori da `DATE_VALUES` di `DateFilter`, quindi aggiungere un valore data non tocca la UI; per un filtro nuovo vedi [Hint e sub-hint nella UI](./07-aggiungere-un-filtro.md#hint-e-sub-hint-nella-ui). Un click su un valore data passa da `toggleDateValue`, che sostituisce il valore corrente o lo toglie se è già quello. `src/SearchUIHelper.ts` righe 47-64

**⚠️ Trappola**: una chip si accende se la sua etichetta compare come sottostringa nella query, non se il filtro è stato riconosciuto. `-` si accende con `this-week`, `base` con `database`, `#` con qualsiasi tag. `src/Finder.ts` righe 66-72
