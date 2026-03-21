# Spec: Obsidian Better Finder

## Panoramica

Plugin per Obsidian che sostituisce il finder nativo con una ricerca avanzata multi-filtro. Disponibile come **popup modale** (keyboard-driven) e come **pannello sidebar** con risultati lazy-loaded.

---

## Tecnologie

| Tecnologia | Versione | Ruolo |
|---|---|---|
| **TypeScript** | 4.7.4 | Linguaggio principale |
| **Obsidian API** | latest | Plugin API — `Plugin`, `SuggestModal`, `ItemView`, `TFile`, `App`, `metadataCache` |
| **MiniSearch** | ^7.2.0 | Full-text search in-memory con fuzzy matching e prefix matching |
| **esbuild** | 0.17.3 | Bundler per sviluppo e produzione |
| **ESLint** | 5.29.0 | Linting (con plugin `@typescript-eslint` e `sonarjs`) |
| **Prettier** | 3.6.2 | Formattazione automatica |
| **CSS custom properties** | — | Theming automatico tramite variabili CSS native di Obsidian |

---

## Architettura

### Flusso dati

```
Utente digita nella ricerca
  → Finder.search(query) [debounce 150ms]
    → SearchStrategyFactory.parse(query)
      Estrae: tag, date, tipi file, scope, task, path, testo libero
    → SearchStrategyFactory.filter()
      Applica filtri strutturali in ordine:
        1. Tag (intersezione — tutti i tag richiesti)
        2. Data (mtime file)
        3. Path (inclusione cartella)
        4. Tipo file (estensione)
        5. Task (presenza/stato completamento)
        6. Titolo (basename search)
    → SearchStrategyFactory.filterFreeText()
        Se index pronto e solo markdown → SearchIndex.search()
        Altrimenti → searchFilesWithoutIndex() (fallback)
  → SearchResult[] (TFile | Command)
    → FinderModal: SuggestModal con ModalItem
    → FinderCard: ItemView con Card lazy-loaded (20 per batch)
```

### Pattern architetturali

- **Strategy** — ogni filtro implementa `SearchFilter<T>` con `extract()`, `removeFrom()`, `filter()`
- **Factory** — `SearchStrategyFactory` (singleton) crea e orchestra tutti i filtri
- **Singleton** — `SearchIndex` e `SearchStrategyFactory` via `getInstance()`
- **Lazy loading** — `IntersectionObserver` in `FinderCard` (scroll infinito, 20 item/batch)
- **Component composition** — UI costruita da piccoli componenti annidati

---

## Moduli principali

### Entry point

| File | Ruolo |
|---|---|
| `main.ts` | Lifecycle del plugin, registra comandi e view, gestisce eventi vault, possiede `SearchIndex` singleton |

### Engine

| File | Ruolo |
|---|---|
| `src/Finder.ts` | Orchestrazione ricerca — debounce, modalità command, apertura risultati |
| `src/engine/SearchIndex.ts` | Wrapper MiniSearch — indicizzazione lazy a batch (100 file), aggiornamenti live |
| `src/engine/SearchStrategy.ts` | `SearchStrategyFactory` — parsing query, applicazione filtri in ordine |
| `src/engine/search-filters/` | Filtri individuali (vedi sotto) |
| `src/SearchHistory.ts` | Gestione cronologia ricerche — add, getAll, clear, persistenza su settings |

### UI — Viste

| File | Ruolo |
|---|---|
| `src/FinderModal.ts` | Popup modale — estende `SuggestModal`, integra HintBar e HistoryBar |
| `src/FinderCard.ts` | Sidebar — estende `ItemView`, scroll infinito via IntersectionObserver |
| `src/FinderSetting.ts` | Tab impostazioni plugin (toggle ribbon icon) |

### UI — Componenti

| File | Ruolo |
|---|---|
| `src/component/Card.ts` | Card risultato per sidebar (titolo, badge, preview, metadata) |
| `src/component/ModalItem.ts` | Item risultato per modale (titolo, badge, tag, task) |
| `src/component/ui/SearchBar.ts` | Input di ricerca con counter risultati e toggle vista |
| `src/component/ui/HintBar.ts` | Chip cliccabili per suggerire filtri disponibili |
| `src/component/ui/HistoryBar.ts` | Barra cronologia ricerche con chip e pulsante clear |
| `src/component/ui/SuggestionItem.ts` | Item generico — titolo, badge, metadata, tag, task, hotkey |
| `src/component/ui/Title.ts` | Titolo con badge opzionale |
| `src/component/ui/Metadata.ts` | Data e path del file |
| `src/component/ui/Tags.ts` | Chip tag con highlight dei tag cercati |
| `src/component/ui/TaskBadge.ts` | Badge completamento task (✓ done/total) |
| `src/component/ui/Hotkey.ts` | Visualizzazione scorciatoia tastiera |
| `src/component/ui/Preview.ts` | Container anteprima contenuto |
| `src/component/ui/CodePreview.ts` | Anteprima codice (pre/code) per JSON |
| `src/component/ui/ToggleButton.ts` | Toggle griglia/lista |
| `src/component/ui/ResultsContainer.ts` | Wrapper risultati con classe grid/list view |

### Constants

| File | Ruolo |
|---|---|
| `src/const.ts` | Stringhe i18n (italiano) ed emoji icone |

---

## Filtri disponibili

| Sintassi | Filtro | Note |
|---|---|---|
| `#tag` | Tag | Supporta tag nidificati (`#tag/subtag`); tutti i tag richiesti |
| `today` | Data — oggi | Confronto su `file.stat.mtime` |
| `this week` | Data — settimana corrente | Settimana da domenica |
| `this month` | Data — mese corrente | |
| `title:testo` | Titolo/basename | Cerca solo nel nome file |
| `task:` | File con task | Qualsiasi task |
| `task-todo:` | File con task aperte | Task non completate |
| `task-done:` | File con task chiuse | Task completate |
| `pdf` | Tipo file PDF | |
| `image` / `img` | Immagini | .png, .jpg, .jpeg, .gif, .webp |
| `canvas` | Canvas Obsidian | |
| `json` | File JSON | |
| `base` | File .base | |
| `path:cartella` | Percorso cartella | Inclusione parziale case-insensitive |
| `>comando` | Modalità comandi | Lista e lancia comandi Obsidian |
| testo libero | Full-text search | MiniSearch (fuzzy 0.2, prefix, basename 5× peso) |

---

## Funzionalità

### Ricerca
- Debounce 150ms sull'input
- Filtri combinabili nella stessa query (es. `#progetto today pdf`)
- Risultati ordinati per mtime (più recenti prima) in assenza di testo libero
- Fallback a ricerca lineare se l'indice MiniSearch non è pronto

### Indicizzazione
- Solo file markdown vengono indicizzati con MiniSearch
- Build iniziale a batch di 100 file con notifiche di avanzamento
- Aggiornamenti live via eventi vault (`create`, `delete`, `rename`) e `metadataCache.changed`
- Basename pesato 5× nel ranking

### UI Sidebar
- Scroll infinito con `IntersectionObserver` (20 risultati per batch)
- Toggle griglia/lista
- Preview contenuto: markdown (prime 500 chars, YAML rimosso), JSON (prime 300 chars), immagini/canvas via `MarkdownRenderer`
- Context menu nativo Obsidian (file-menu)

### Cronologia ricerche
- Salva automaticamente ogni query eseguita
- Max 20 query; query duplicate spostate in cima
- Persistita in `plugin.settings.searchHistory` (sopravvive al riavvio)
- Chip cliccabili per re-eseguire ricerche passate
- Pulsante clear per cancellare tutto

### Impostazioni
- Toggle visibilità icona ribbon

---

## Settings

```typescript
interface ObsidianBetterFinderSettings {
  mySetting: string;
  showRibbonIcon: boolean;
  searchHistory: string[];
}
```

---

## Costanti

- `MAX_HISTORY = 20` — query massime in cronologia
- `PAGE_SIZE = 20` — risultati per batch nel sidebar
- `DEBOUNCE_MS = 150` — debounce input ricerca
- Indice MiniSearch: fuzzy `0.2`, prefix `true`, combine `AND`
- Contenuto indicizzato: max 10 000 chars per file
- Batch indicizzazione: 100 file

---

## Comandi registrati

| Comando | Azione |
|---|---|
| Open Better Finder Modal | Apre il popup modale di ricerca |
| Open Better Finder View | Apre/attiva il pannello sidebar |

---

## File da ignorare

- `src/main.ts` — file sample del template, non usato
- `src/settings.ts` — file sample del template, non usato
