# Plan — Preview canvas/excalidraw/pdf nel FinderModal

> Creato il: 2026-05-07
> Stato: draft

## Obiettivo

Estendere il preview thumbnail (56×56 a destra dei suggerimenti del `FinderModal`) per supportare anche file `.canvas`, `.pdf` ed Excalidraw, oltre alle immagini.
Contestualmente, spostare la logica decisionale "preview sì/no" da `ModalUI` a `FinderModal`, lasciando `ModalUI` come puro renderer.

## Scope

**In:**
- `src/component/interface/Card.ts` — aggiunta proprietà opzionale `renderPreview?: (el: HTMLElement) => void`.
- `src/component/Modal/ModalUI.ts` — rimossa logica decisionale e import di `ImagePreview`/`Component`; usa `setPreview` solo se `renderPreview` è definito.
- `src/FinderModal.ts` — definisce `PREVIEW_EXTENSIONS`, check Excalidraw via frontmatter, costruisce il callback e lo passa a `ModalUI`.

**Out:**
- Nessuna modifica a `ImagePreview.ts` (la logica di rendering è già completa).
- Nessun tipo `ModalData` separato dal generico `Card`.
- Nessun intervento su `FinderView`/`Card.ts` (deprecati, da rimuovere in task separato).

## Approccio tecnico

`ModalUI` diventa dumb component: non sa più cosa siano le estensioni "preview-able"
né `ImagePreview`. Si limita a chiamare `this.item.setPreview(data.renderPreview)`
se il campo è definito.

`FinderModal.renderResult()` invece:
1. Calcola `ext = file.extension.toLowerCase()`.
2. Verifica se è Excalidraw: `ext === 'md' && fileCache?.frontmatter?.['excalidraw-plugin'] === 'parsed'`.
3. Se `PREVIEW_EXTENSIONS.includes(ext) || isExcalidraw`, costruisce un callback
   `(el) => new ImagePreview(this.app, new Component()).load(file, el)`.
4. Passa il callback (o `undefined`) come campo `renderPreview` di `Card`.

`PREVIEW_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'canvas', 'pdf']`.

Il campo `renderPreview` è opzionale su `Card`, quindi l'altro consumatore
dell'interfaccia (`Card.ts` legacy) continua a funzionare ignorandolo.

## Step di implementazione

- [ ] Aggiungere `renderPreview?: (el: HTMLElement) => void` a `src/component/interface/Card.ts`.
- [ ] In `src/component/Modal/ModalUI.ts`: rimuovere `IMAGE_EXTENSIONS`, l'import di `ImagePreview` e `Component`; sostituire il blocco `if (IMAGE_EXTENSIONS.includes(ext))` con `if (data.renderPreview) this.item.setPreview(data.renderPreview);`.
- [ ] In `src/FinderModal.ts`: definire `PREVIEW_EXTENSIONS`, importare `ImagePreview` e `Component`, calcolare `isExcalidraw` + `renderPreview` callback, passarlo a `ModalUI.render()`.
- [ ] `npm run build` e verificare assenza di errori TS.
- [ ] Test manuale: aprire il modal e verificare preview per png, canvas, pdf ed excalidraw.

## Decisioni prese

| Decisione | Alternativa scartata | Motivazione |
|---|---|---|
| Set estensioni B.1 (immagini + canvas + pdf + excalidraw) | A: tutti i file; C: tutto tranne .md puri | Focus su file "visuali", evita rumore con .md di solo testo |
| Callback opzionale `renderPreview` su `Card` | Boolean flag `showPreview`; tipo `ModalData` separato | `ModalUI` resta dumb component; massima separazione di responsabilità con minimo cambio |
| Logica policy in `FinderModal` | Logica in `ModalUI` (stato attuale) | Aderenza al pattern "controller decide, UI renderizza" da CLAUDE.md |
| Rilevamento Excalidraw via frontmatter `excalidraw-plugin: parsed` | Match su filename `*.excalidraw.md` | Coerente con la logica già presente in `ImagePreview.load()` |

## Punti aperti

- [ ] Verificare a runtime che `![[file.canvas]]` produca un thumbnail leggibile in container 56×56. Se no, valutare fallback custom (icona o parsing JSON).
- [ ] `FinderView` (`src/FinderView.ts`) e `Card.ts` legacy: l'utente li considera codice morto. Rimuoverli in task separato (file + registrazione in `main.ts` + riferimento in `CLAUDE.md`).

## Dipendenze

Nessuna. `ImagePreview` supporta già tutti i casi (canvas/pdf via embed `![[…]]`, excalidraw via frontmatter check, immagini via embed).

## Note

- Il preview Excalidraw funziona perché il plugin Excalidraw intercetta gli embed `![[…]]` di file con `excalidraw-plugin: parsed` e li renderizza come SVG/PNG.
- Per `.canvas` Obsidian non ha un renderer nativo per embed: il risultato dipende da come si comporta `MarkdownRenderer.render('![[file.canvas]]')`. Va verificato visualmente.
