# Plan — Preview canvas/excalidraw/pdf nel FinderModal

> Creato il: 2026-05-07
> Stato: done

## Obiettivo

Estendere il preview thumbnail (56×56 a destra dei suggerimenti del `FinderModal`) per supportare anche file `.canvas`, `.pdf` ed Excalidraw, oltre alle immagini.
Contestualmente, spostare la logica decisionale "preview sì/no" da `ModalUI` a `FinderModal`.

## Scope

**In:**
- `src/component/interface/Card.ts` — aggiunta proprietà opzionale `renderPreview?: boolean`.
- `src/component/Modal/ModalUI.ts` — rimossa la logica `IMAGE_EXTENSIONS`; istanzia `ImagePreview` solo se `renderPreview` è `true`.
- `src/FinderModal.ts` — definisce `PREVIEW_EXTENSIONS`, calcola check Excalidraw via frontmatter, passa il flag booleano a `ModalUI`.

**Out:**
- Nessuna modifica a `ImagePreview.ts` (la logica di rendering è già completa).
- Nessun tipo `ModalData` separato dal generico `Card`.
- Nessun intervento su `FinderCard`/`Card` legacy (da rimuovere in task separato).

## Approccio tecnico

Variante **flag booleano** (semplice, minimo accoppiamento sui tipi):

`Card` espone `renderPreview?: boolean`. `ModalUI` riceve il flag e, se `true`, istanzia internamente `new ImagePreview(this.app, new Component())` e lo passa a `setPreview`. La logica di "quale file merita un preview" vive in `FinderModal`, mentre il "come si fa il preview" resta incapsulato in `ModalUI` + `ImagePreview`.

`FinderModal.renderResult()`:
1. Calcola `ext = file.extension.toLowerCase()`.
2. Verifica Excalidraw: `ext === 'md' && fileCache?.frontmatter?.['excalidraw-plugin'] === 'parsed'`.
3. Calcola `renderPreview = PREVIEW_EXTENSIONS.includes(ext) || isExcalidraw`.
4. Passa il booleano come campo `renderPreview` di `Card`.

`PREVIEW_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'canvas', 'pdf']`.

Il campo `renderPreview` è opzionale su `Card`, quindi l'altro consumatore dell'interfaccia (`FinderCard` legacy) continua a funzionare ignorandolo.

### Nota su scelta finale (callback → flag)

In fase di implementazione la variante callback è stata sostituita dal flag booleano. Trade-off:
- **Pro flag**: tipi più semplici, `Card` resta una pura data interface (no funzioni nei dati), meno verboso al call site.
- **Contro flag**: `ModalUI` continua a importare `ImagePreview` e a sapere *come* costruirne uno — la separazione "controller decide, UI renderizza" è parziale (decide quando, non come).

Il flag è stato preferito per pragmatismo: meno boilerplate, e il "come" del preview è di fatto unico in tutta la modal.

## Step di implementazione

- [x] Aggiungere `renderPreview?: boolean` a `src/component/interface/Card.ts`.
- [x] In `src/component/Modal/ModalUI.ts`: rimuovere `IMAGE_EXTENSIONS`; sostituire il blocco con `if (renderPreview) this.item.setPreview((el) => new ImagePreview(this.app, new Component()).load(file, el));`.
- [x] In `src/FinderModal.ts`: definire `PREVIEW_EXTENSIONS`, calcolare `isExcalidraw` e `renderPreview`, passarli a `ModalUI.render()`.
- [x] `npm run build` — passa senza errori TS.
- [ ] Test manuale: aprire il modal e verificare preview per png, canvas, pdf ed excalidraw.

## Decisioni prese

| Decisione | Alternativa scartata | Motivazione |
|---|---|---|
| Set estensioni B.1 (immagini + canvas + pdf + excalidraw) | A: tutti i file; C: tutto tranne .md puri | Focus su file "visuali", evita rumore con .md di solo testo |
| Flag booleano `renderPreview?: boolean` su `Card` | Callback `(el) => void`; tipo `ModalData` separato | Tipi più semplici, `Card` resta pura data interface, meno boilerplate al call site |
| Logica policy in `FinderModal` | Logica in `ModalUI` (stato precedente al refactor) | Aderenza al pattern "controller decide, UI renderizza" da CLAUDE.md |
| Rilevamento Excalidraw via frontmatter `excalidraw-plugin: parsed` | Match su filename `*.excalidraw.md` | Coerente con la logica già presente in `ImagePreview.load()` |

## Punti aperti

- [x] ~~Verificare a runtime che `![[file.canvas]]` produca un thumbnail leggibile in container 56×56.~~ Obsidian rende i canvas embed come `.canvas-minimap` dentro `.inline-embed`: la classe è stata targettata esplicitamente nel CSS per fittare nei 56×56.
- [ ] **Performance**: Excalidraw e PDF fanno partire un rendering pesante per ogni item visibile in lista. Con N file Excalidraw nei risultati il modal "freeza" qualche secondo prima di sbloccarsi. Soluzione candidata: lazy load via `IntersectionObserver` (pattern già endorsed da CLAUDE.md). Alternative: cache `path → HTMLElement`, estrazione PNG embedded da Excalidraw, throttle sui primi N. Per ora si può convivere col problema o disabilitare excalidraw/pdf da `PREVIEW_EXTENSIONS` lasciando solo immagini.
- [ ] Errore Mermaid in console quando un file Excalidraw contiene blocchi `mermaid` con sintassi non standard: `MarkdownRenderer.render` invoca il parser e fallisce. Non blocca il rendering dell'immagine ma sporca la console.
- [ ] `FinderCard` (`src/FinderCard.ts`) e `Card` legacy: codice morto secondo l'utente. Rimuoverli in task separato (file + registrazione in `main.ts` + riferimento in `CLAUDE.md`).

## CSS rules apprese

- Canvas embed → wrapper `.inline-embed > .canvas-minimap` (mini-mappa renderizzata da Obsidian).
- PDF embed → `.pdf-embed` con `iframe`/`canvas` interni e `.pdf-toolbar`/`.pdf-controls` da nascondere.
- Excalidraw → renderizzato via plugin con `<canvas>` HTML; **non** applicare `canvas { width:100% !important }` globale o si rompe — usare `max-width/max-height: 100%` sul wrapper invece.

## Dipendenze

Nessuna. `ImagePreview` supporta già tutti i casi (canvas/pdf via embed `![[…]]`, excalidraw via frontmatter check, immagini via embed).

## Note

- Il preview Excalidraw funziona perché il plugin Excalidraw intercetta gli embed `![[…]]` di file con `excalidraw-plugin: parsed` e li renderizza come SVG/PNG.
- Per `.canvas` Obsidian non ha un renderer nativo per embed: il risultato dipende da come si comporta `MarkdownRenderer.render('![[file.canvas]]')`. Va verificato visualmente.
