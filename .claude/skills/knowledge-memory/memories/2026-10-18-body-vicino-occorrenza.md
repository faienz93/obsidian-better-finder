# Body renderizzato vicino all'occorrenza (grilling da fare)

- **Fonte:** conversazione del 2026-10-18 (grilling sul candidato 2 della revisione architetturale)
- **Creato il:** 2026-10-18
- **Ultimo aggiornamento:** 2026-10-18

## Contesto
Durante il grilling sul candidato 2 (un solo costruttore del Data per Card e Item) l'utente ha chiesto
un Body che mostri *dove* si trova la parola cercata, per ogni tipo di file, invece della Preview
dell'intero file. È stato tenuto fuori dal candidato 2 e va affrontato in un grilling separato.

## Contenuto
Cosa vuole l'utente:

- **Note**: nella Card, il markdown renderizzato del passaggio attorno alla parola, invece del testo
  semplice. Esempio: cerco "ciao" e lo vedo con titoli, liste e checkbox disegnati.
- **Canvas, mermaid, Excalidraw**: renderizzare la zona vicino alla parola, non tutto il disegno.
  "Una preview di tutto il canvas enorme o del mermaid non mi dice niente, se cerco ciao vorrei
  vedere al volo dove si trova."
- **Tutte le occorrenze**, come `grep -C`: se "ciao" sta alle righe 1, 7 e 10 le voglio vedere tutte.
- Un pulsante "Preview" per tornare alla Preview completa (nel candidato 2 c'è già per le note nella
  Card).

Punti già emersi:

- Per renderizzare markdown il passaggio deve restare markdown valido. Proposta accettata in linea
  di principio: il blocco che contiene la parola più quello prima e quello dopo, con i confini presi
  da `metadataCache.sections`; un code block si prende intero.
- `MarkdownRenderer.render` fa girare i post-processor degli altri plugin (execute-code, mermaid):
  vedi [2026-10-18-freeze-moodboard.md](2026-10-18-freeze-moodboard.md). Nella Card oggi la Preview
  md paga già questo costo.
- L'utente ha proposto pretext (https://github.com/chenglou/pretext). Da Context7: misura altezza e
  numero di righe del testo senza reflow del DOM (`prepare` + `layout`). Non disegna markdown e non
  cerca parole. Può servire per sapere quante occorrenze entrano in una Card.

## Decisioni
- 2026-10-18: nel candidato 2 il Body mostra le Occurrences in testo semplice, sia nelle Card sia
  negli Item. Canvas ed Excalidraw mostrano la Preview come oggi. Il resto va nel grilling separato.

## Domande aperte
- Cosa permettono gli embed di Obsidian: zoom di una canvas su un nodo, di un Excalidraw su un
  elemento, evidenziare un nodo mermaid?
- Per gli allegati con testo estratto (PDF, docx): Occurrences prese dal testo estratto? Oggi
  l'estrazione non è installata sul PC dell'utente.
