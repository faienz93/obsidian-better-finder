# Plan — Roadmap Better Finder

> Creato il: 2026-07-11
> Stato: implementato (branch `feature/roadmap-better-finder`) — in attesa di test manuale

## Stato esecuzione — 2026-07-11

Tutte le voci implementate e committate (un commit per voce, build + 30 unit test verdi).

| Voce | Stato | Note |
| ---- | ----- | ---- |
| 1. Navigazione indietro | ✅ | `navigation = true` su FinderCard |
| 2. HintBarSub dumb | ✅ | valori da `DATE_VALUES` (DateFilter) + anno corrente + placeholder |
| 3. UX chip | ✅ | `toggleDateValue`: mutua esclusione, deselezione, no spazio |
| 4. Snippet con highlight | ✅ | nuovo `SnippetPreview`, campo `snippetTerm` su Card |
| 5. Dedup risultati | ✅ | per path in `Finder.getResults` |
| 6. NegationFilter | ✅ | `-image`, `-#tag`, `-docx` (estensione letterale) |
| 7. Tag #archive | ✅ | esclusi di default, visibili con `#archive` esplicito |
| 8. Tag nei canvas | ✅ | nuova `CanvasTagCache` + eventi vault |
| 9. Xberg PDF+OCR | ⚠️ codice fatto | **binario non installato**: flag CLI da verificare al primo uso reale (`extract --format json`); cache mtime persistente in `xberg-cache.json` |
| 10. Preview Word/Excel | ✅ | icona+badge; estratto testuale via Xberg se disponibile |
| 11. MetadataFilter | ✅ | `author:x` + `key:value` generico su frontmatter |
| 12. Cronologia ricerche | ⚠️ parziale | persistita + frecce ↑/↓ nella sidebar; **non nel modal** (frecce già usate dai suggerimenti) |
| 13. Export MD | ✅ | bottone ⤓ nella sidebar |
| 14. Jest | ✅ | 30 test (strategy + parse); E2E wdio non fatto (opzionale) |
| B1 falsi positivi | ✅ | fuzzy solo ≥6 char, prefix solo ultimo token |
| B2 tag cugini | ✅ | rimosso `startsWith(tag+'-')` |
| B3 #WAF | ✅ | tag file normalizzati lowercase |
| B4 task: | ✅ | regex fixata (`\b` dopo `:`) + nuovo `TaskSnippet` mostra il testo dei task |
| B5 highlights | ✅ | match a confine di parola |

**Per testare la voce 9**: installare il binario (`cargo install xberg-cli` o release GitHub
di xberg-io/xberg) e riavviare il plugin; verificare i flag CLI effettivi e correggere
`XbergExtractor.extractText` se necessario.

## Obiettivo

Consolidare il TODO in un piano implementativo eseguibile voce per voce: feature
ordinate per fasi, bug in coda, mobile escluso, doppioni unificati. Ogni voce ha
approccio tecnico, file coinvolti e complessità (S/M/L), seguendo i pattern già
presenti nel codice (strategy per i filtri, componenti UI dumb, logica nei controller).

## Scope

**In:**
- Tutte le voci aperte del backlog e di "In Progress" (al netto delle regole sotto)
- OCR immagini via Xberg (deciso: dentro il piano, voce 9)
- Bug noti, in coda al piano

**Out:**
- Ottimizzazione mobile (esclusa esplicitamente)
- Voci "Non previste": fuzzy search, tema UI, sidebar comandi, AND/OR/NOT,
  ricerche salvate, impostazioni avanzate
- Voci già in "Completato" (vincono su "In Progress")

---

## Fase 0 — Quick win

### 1. Navigazione indietro dopo apertura file (S)

Aprendo un file dal finder, il pulsante indietro di Obsidian non riporta alla vista.

- **Causa**: `Finder.ts:121` usa `getLeaf(false).openFile(file)` e `FinderCard`
  non dichiara `navigation`, quindi la view non entra nella history di navigazione.
- **Approccio**: aggiungere `get navigation(): boolean { return true; }` in
  `FinderCard`; verificare che `openFile` registri la history (eventualmente
  `getLeaf(false)` → leaf esplicita con `openLinkText`).
- **File**: `src/FinderCard.ts`, `src/Finder.ts`
- **Test**: aprire finder → aprire file → Ctrl+Alt+← → si torna al finder.

## Fase 1 — Sub-hint bar

### 2. Refactor: HintBarSub senza logica (M)

C'è già il TODO nel codice (`HintBarSub.ts:3`): i `DATE_VALUES` sono hardcoded
nel componente.

- **Approccio**: `HintBarSub` diventa dumb component che riceve `values: string[]`
  (+ eventuale placeholder) dal costruttore o da un metodo `setContent()`.
  La conoscenza di *quali* valori mostrare passa al chiamante (`SearchUIHelper`),
  che la deriva dalle strategy (es. `DateFilter` espone i suoi valori validi).
- Include: mostrare l'anno corrente tra i valori; placeholder che indica il
  supporto `YYYY/MM/DD`.
- **File**: `src/component/ui/HintBarSub.ts`, `src/SearchUIHelper.ts`,
  `src/engine/search-filters/DateFilter.ts`

### 3. UX chip: selezione ed inserimento query (M)

Tre comportamenti da sistemare, stessa area:

- **Selezione mutuamente esclusiva**: cliccando un chip data si deseleziona il
  precedente (in query e in UI).
- **Deselezione al re-click**: ricliccare il chip attivo rimuove il token dalla query.
- **Niente spazio**: il click deve produrre `created:today` (non `created: today`)
  e sostituire un eventuale valore precedente (`created:yesterday` → `created:today`).
  Il parsing con e senza spazio deve comunque comportarsi allo stesso modo
  (tolleranza in `DateFilter.extract`).
- **File**: `src/SearchUIHelper.ts`, `src/component/ui/HintBarSub.ts`,
  `src/engine/search-filters/DateFilter.ts`
- **Dipende da**: voce 2 (conviene rifattorizzare prima).

## Fase 2 — Qualità dei risultati

### 4. Snippet di contenuto con termine evidenziato (M)

*(fusione di "snippet nelle card" + "mostrare il testo se cerco 'ciao'")*

- **Approccio**: quando la ricerca free-text matcha nel contenuto, estrarre un
  intorno del match (±N caratteri) e mostrarlo nel risultato con il termine
  evidenziato (`<mark>` o classe CSS). MiniSearch espone i match; per il fallback
  senza indice l'estratto si ricava durante la scansione.
- Rendering: campo opzionale `snippet` su `Card`, renderizzato da `ModalItem`
  (stesso pattern di `renderPreview`).
- **File**: `src/engine/SearchIndex.ts`, `src/Finder.ts`,
  `src/component/interface/Card.ts`, `src/component/Modal/ModalItem.ts`

### 5. Rimozione duplicati dai risultati (S)

- **Approccio**: dedup per `file.path` nel punto di unione dei risultati in
  `Finder.search()` (Set sui path). Indagare prima *dove* nascono i duplicati
  (probabile unione indice + fallback).
- **File**: `src/Finder.ts`

### 6. Esclusione risultati con `-` (M)

Es. `-image` esclude le immagini, `-#tag` esclude un tag.

- **Approccio**: nuova strategy `NegationFilter` secondo il pattern esistente
  (`extract` → token `-x`, `removeFrom`, `filter` → complemento). Registrata
  nella `SearchStrategyFactory`. Prima iterazione: negazione di tipi file e tag.
- **File**: nuovo `src/engine/search-filters/NegationFilter.ts`,
  `src/engine/search-filters/index.ts`, `src/engine/SearchStrategy.ts`

### 7. Tag speciale `archive` (S)

- **Approccio**: i file con tag `#archive` sono esclusi di default dai risultati;
  ricercabili solo se la query contiene esplicitamente `#archive`.
  Filtro applicato in `Finder.search()` dopo le strategy.
- **File**: `src/Finder.ts`, `src/engine/search-filters/TagsFilter.ts`

## Fase 3 — Copertura contenuti

### 8. Tag dentro i canvas (M)

`#spring` deve trovare anche il canvas di Spring.

- **Approccio**: i `.canvas` sono JSON con nodi testo: estrarre i tag dai nodi
  (`metadataCache` non li indicizza). Estendere `TagsFilter.filter` per leggere
  i tag dai canvas (con cache per non riparsare a ogni ricerca).
- **Nota CLAUDE.md**: aggiornare *insieme* indicizzazione e preview per i nuovi tipi.
- **File**: `src/engine/search-filters/TagsFilter.ts`, `src/engine/SearchIndex.ts`

### 9. Estrazione contenuti via Xberg: PDF + OCR immagini (L)

> ⚠️ La libreria scelta (kreuzberg) è stata rinominata **Xberg** (`xberg-io/xberg`,
> MIT, core Rust). La vecchia `kreuzberg-dev/kreuzberg` è legacy LTS fino a fine 2026.
> Decisione presa: si usa **Xberg** con integrazione **sidecar CLI**.

- **Approccio**: binario CLI `xberg` invocato via `child_process.execFile` con
  output `--format json`; il testo estratto entra nell'indice MiniSearch
  (campo dedicato, indicizzazione lazy con cache basata su `mtime` per non
  rallentare l'avvio).
- **Step 1 — PDF**: estrazione testo (nativa Rust, nessuna dipendenza di sistema).
- **Step 2 — OCR immagini**: backend Tesseract (richiede `tesseract-ocr`
  installato sul sistema) oppure backend Candle (Rust puro, zero dipendenze,
  più giovane — da provare per primo).
- **Prerequisito**: binario installato dall'utente (`cargo install` o release
  binaria); il plugin rileva la presenza del binario e degrada con grazia se manca.
- **Alternative scartate**: NAPI in-process (`@kreuzberg/node`) → rischio
  mismatch ABI con l'Electron di Obsidian, richiederebbe electron-rebuild e
  binari per piattaforma; WASM → supporto OCR non confermato nel build WASM;
  server HTTP locale → overkill per un plugin desktop personale.
- **Nota implementativa**: riconfermare nome pacchetto/binario su npm/GitHub al
  momento dell'implementazione — progetto in piena transizione kreuzberg→Xberg.
- **File**: `src/engine/SearchIndex.ts`, `main.ts` (eventi vault),
  nuovo modulo `src/engine/XbergExtractor.ts`

### 10. Preview Word / Excel (M)

- **Approccio**: estendere `ImagePreview` (o componente affine) con i casi
  `.docx`/`.xlsx`. Obsidian non li renderizza nativamente: prima iterazione =
  icona/badge dedicato + metadati; con la voce 9 in piedi, l'estratto testuale
  di Xberg può alimentare una preview testuale vera (Xberg supporta docx/xlsx).
- **File**: `src/component/ui/ImagePreview.ts`, `src/FinderModal.ts`
- **Sinergia**: dopo la voce 9, valutare anche l'indicizzazione full-text di
  docx/xlsx via Xberg (stesso extractor).

### 11. Ricerca per autore / metadati (M)

- **Approccio**: nuova strategy `MetadataFilter` (`author:nome`, generalizzabile
  a `key:value` sul frontmatter via `metadataCache.getFileCache(file).frontmatter`).
- **File**: nuovo `src/engine/search-filters/MetadataFilter.ts`,
  `src/engine/search-filters/index.ts`

## Fase 4 — Funzioni accessorie

### 12. Cronologia ricerche (M)

- **Approccio**: salvare le ultime N query in `saveData()` del plugin; mostrarle
  quando la query è vuota (nel modal come suggerimenti iniziali). Navigazione
  con frecce ↑/↓ come nei terminali.
- **File**: `main.ts`, `src/FinderModal.ts`, `src/Finder.ts`

### 13. Esportazione risultati in MD (S)

- **Approccio**: comando/bottone che serializza i risultati correnti in una nota
  (lista di wikilink + metadati). Creazione file via `vault.create`.
- **File**: `src/Finder.ts`, `src/FinderCard.ts`, `src/const.ts` (stringhe i18n)

## Fase 5 — Trasversale

### 14. Test unitari, JSDoc, i18n, refactoring (L, incrementale)

- **Approccio** (dalla ricerca del 2026-07-11): Jest per la logica pura — le
  strategy (`extract`/`removeFrom`/`filter`) e `SearchIndex` si testano con
  oggetti `TFile`-shaped finti, senza Electron. E2E UI opzionale in seconda
  battuta con `wdio-obsidian-service` (v3.1.1, mantenuto). JSDoc e stringhe
  i18n si completano voce per voce nelle fasi precedenti, non come big-bang finale.
- **File**: nuovo `jest.config`, `test/`, tutti i moduli engine

---

## 🐛 Bug (in coda, ordine di aggressione suggerito)

### B1. Falsi positivi full-text: "Bacca", "printenv" (M)

*(fusione di due voci — stessa causa sospetta)*

- **Causa sospetta**: `SearchIndex.ts:28-29` — `fuzzy: 0.2` + `prefix: true`
  fanno matchare termini lontani.
- **Approccio**: ridurre/condizionare fuzzy e prefix (es. prefix solo sull'ultimo
  token digitato, fuzzy solo oltre N caratteri); confrontare i risultati con la
  ricerca nativa di Obsidian sui casi citati.

### B2. `#prompt` / `#pattern`: conteggio risultati sbagliato (M)

*(fusione di due voci — due test case, stessa indagine)*

- **Causa sospetta**: `TagsFilter.ts:29` — `ft.startsWith(tag + '-')` fa
  matchare tag "cugini" (`#prompt` piglia anche `#prompt-engineering`);
  da chiarire se è voluto per la gerarchia o va limitato a `tag + '/'`.

### B3. Tag `#WAF` non funziona (S)

- **Causa sospetta**: case sensitivity — `TagsFilter` lowercasa la query
  (`TagsFilter.ts:12`) ma va verificato che anche i tag dei file siano
  normalizzati allo stesso modo nel confronto.

### B4. Hint `task:` non funziona (M)

- **Atteso**: cliccando l'hint `task:` devono comparire le card dei file con
  todo, mostrando solo il testo del task, con lo stesso stile delle voci evidenziate.
- **Indagine**: la logica di `TaskFilter` sembra corretta — verificare che il
  click sull'hint inserisca il token giusto in query e che il rendering estragga
  il testo dei task (`cache.listItems` + lettura riga) invece del contenuto generico.
- **File**: `src/SearchUIHelper.ts`, `src/engine/search-filters/TaskFilter.ts`,
  `src/FinderModal.ts`

### B5. Highlights evidenziano troppe cose (M)

- **Indagine**: partire da `HighlightFilter` e dal rendering dei match; probabile
  correlazione con B1 (fuzzy/prefix allargano i termini da evidenziare).
  Da affrontare **dopo B1**.

---

## Da valutare (non pianificate)

- **Backlink search / linked file dalla ricerca** — nel TODO con "??": feature
  interessante ma scope ampio; decidere se e come dopo la Fase 3.
- **"In finder card deve mostrarmi tutte le card?"** — da chiarire il
  comportamento atteso a query vuota (mostrare tutto il vault? solo recenti?).

## Decisioni prese

| Decisione | Alternativa scartata | Motivazione |
| --------- | -------------------- | ----------- |
| "Non previste" vince su "In Progress" | riaprirle | conferma utente |
| "Completato" vince su "In Progress" | rifarle | residui di merge |
| OCR nel piano, via Xberg CLI sidecar | estensione futura / NAPI / WASM | richiesto dall'utente; sidecar = zero problemi ABI con Electron |
| Xberg (attivo) invece di kreuzberg v4 | linea legacy LTS | kreuzberg è frozen, fix solo fino a fine 2026 |
| Bug "Bacca"+"printenv" fusi | trattarli separati | stessa causa sospetta (fuzzy/prefix) |
| Bug `#prompt`+`#pattern` fusi | trattarli separati | stessa area (TagsFilter) |
| Chip UX accorpata al refactor sub-hint | voce separata | stessa area di codice |
| Test con Jest sulla logica pura | jest-environment-obsidian | pacchetto stale (2023, WIP) |

## Punti aperti

- [x] B4: rendering "solo il testo" → implementato con `TaskSnippet` (max 3 task per card)
- [x] Voce 10: prima iterazione badge+icona, con estratto testuale se Xberg presente
- [ ] Voce 9: installare il binario xberg e verificare i flag CLI reali
- [ ] Voce 9: backend OCR — Candle (zero dipendenze) vs Tesseract (maturo): provare Candle per primo
- [ ] Voce 12: cronologia nel modal (le frecce sono occupate dai suggerimenti — serve altra UX)
- [ ] Test manuale complessivo in Obsidian (`npm run dev` + esercizio UI)
- [ ] Le due voci "Da valutare"

## Dipendenze

- Voce 3 dipende da voce 2 (refactor prima della UX)
- Voce 10 (preview testuale vera) beneficia della voce 9 (extractor Xberg)
- B5 va affrontato dopo B1
- Voce 14 (test) conviene avviarla presto: le fix dei bug B1-B3 sono
  perfette come primi test case di regressione

## Note

- Mobile escluso esplicitamente da questa roadmap.
- Xberg richiede il binario CLI installato sul sistema (Linux primario);
  il plugin deve degradare con grazia in sua assenza.
- E2E UI: `wdio-obsidian-service` è lo standard de-facto se in futuro si vuole
  testare il rendering reale del modal — vedi ricerca del 2026-07-11.
