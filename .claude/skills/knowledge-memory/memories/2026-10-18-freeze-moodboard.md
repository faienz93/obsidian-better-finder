# Freeze della Moodboard con alcune Query

- **Fonte:** conversazione del 2026-10-18 (log della console di Obsidian incollato dall'utente)
- **Creato il:** 2026-10-18
- **Ultimo aggiornamento:** 2026-10-18

## Contesto
L'utente segnala che la Moodboard si blocca dopo un paio di Query. Non ha detto quali. Rimandato:
non va trattato nella sessione in cui è stato segnalato (grilling sul candidato 2, costruttore di Card).

## Contenuto
Cosa dice il log:

- Lo stack degli errori parte dallo scroll della Moodboard:
  `handleIntersection` / `onSearch` → `loadMoreItems` → `renderResult` → `render` (GridCard/ListCard)
  → `load` (ImagePreview) → `MarkdownRenderer.render` di Obsidian.
- Il rendering markdown della Preview fa girare i post-processor di altri plugin installati nel vault:
  - `execute-code`: `Error finding code block range: Probably because of 'run-' prefix`, ripetuto
    (10×, 2×, 6×, 2×);
  - mermaid: `Parse error on line 17: ...i root] sbin[/s ... Expecting 'NODE_DEND'`, cioè un
    diagramma mermaid malformato in una nota del vault.
- `GET blob:app://obsidian.md/... net::ERR_FILE_NOT_FOUND`: un blob URL già revocato quando la
  Preview prova a caricarlo.
- Il plugin si carica tre volte nella stessa sessione (ricarica). Ogni volta stampa
  `Plugin runned from Mobile!`, anche se l'utente è su desktop.
- L'Indice si costruisce in 1,4–2,5 s su circa 1188 note. Xberg non è installato
  (`No xberg/kreuzberg binary found`).

## Domande aperte
- Quali Query causano il freeze? Secondo l'utente "un po' tutte". Nel vault c'è la nota di prova
  `progetto-x.md` (root), creata durante il grilling sul candidato 2. Ipotesi da verificare: Query che restituiscono molte note `.md`
  con code block o diagrammi pesanti. Ogni Preview md renderizza il markdown completo e risveglia
  i plugin degli altri (execute-code, mermaid).
- Il freeze dipende dal rendering delle Preview o da altro? Il log mostra errori, non tempi.
- `Plugin runned from Mobile!` su desktop non c'entra con il freeze. Il messaggio sta in
  `main.ts:32–33` dentro `if (!Platform.isMobile)`, quindi la scritta è invertita rispetto alla
  condizione. Resta da decidere se va corretta.
- Da dove viene il blob URL revocato?
- Collegato: la simplify review del 2026-10-17 (C1) segnala che le Preview del Modal si caricano
  tutte subito invece che solo per le righe visibili.
