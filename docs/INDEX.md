# Wiki del Progetto: Obsidian Better Finder

> Documentazione tecnica generata automaticamente. Aggiornata al: 2026-10-24

## Indice

- [Panoramica architettura](./01-architettura.md): il giro completo del plugin, i moduli, lo stack
- [Flusso: ricerca dal Modal](./02-flusso-ricerca.md): da una query digitata alla Data di ogni risultato, fino al file aperto
- [Indicizzazione all'avvio e Common cache allineate](./03-flusso-indicizzazione.md): Index MiniSearch, tag dei canvas, testo estratto da Xberg e gli eventi del vault
- [Sintassi della query, comandi e impostazioni](./04-sintassi-query.md): ogni filtro con esempi, i comandi del plugin, `data.json`
- [CI/CD e rilascio](./05-ci-cd.md): esbuild, il workflow GitHub Actions, come si pubblica una versione
- [Interfaccia: il Modal e la Moodboard](./06-interfaccia.md): le due viste, la Data, il Body e la cronologia
- [Aggiungere un filtro alla query](./07-aggiungere-un-filtro.md): la guida passo per passo

## Il sistema in un colpo d'occhio

Better Finder è un plugin Obsidian che sostituisce la ricerca rapida con una query unica. Nella stessa riga si mescolano filtri (`#tag`, `created:this-week`, `pdf`, `path:`, `-image`) e testo libero. Ogni vista passa da `LatestSearch`, che lascia arrivare solo l'ultima ricerca digitata, poi la query attraversa la catena di filtri e l'Index MiniSearch, tenuto allineato dagli eventi del vault insieme alle altre Common cache. La ricerca restituisce un `SearchOutcome` e `buildResultData` decide una volta sola cosa mostra ogni risultato, sia nel Modal guidato da tastiera sia nella Moodboard a griglia o lista.

```mermaid
flowchart LR
    U[Utente] --> V[FinderModal / FinderMoodboard]
    V --> L[LatestSearch]
    L --> F[Finder]
    F --> S[SearchStrategyFactory]
    S --> FI[Filtri della query]
    S --> I[SearchIndex MiniSearch]
    E[Eventi del vault] --> C[Common cache]
    C --> I
    F --> R[buildResultData]
    R --> V
```

## Da dove partire

| Se vuoi... | Leggi |
|---|---|
| capire cosa succede quando l'utente digita una query | [Flusso: ricerca dal Modal](./02-flusso-ricerca.md) |
| sapere quali filtri esistono e come si scrivono | [Sintassi della query](./04-sintassi-query.md) |
| aggiungere un nuovo filtro | [Aggiungere un filtro](./07-aggiungere-un-filtro.md) |
| capire perché un file non compare nei risultati di testo libero | [Indicizzazione](./03-flusso-indicizzazione.md) |
| cambiare cosa mostra un risultato (tag evidenziati, conteggio task, Preview) | [La Data di un risultato](./06-interfaccia.md#la-data-di-un-risultato) |
| compilare, testare e rilasciare una versione | [CI/CD e rilascio](./05-ci-cd.md) |

## Stack tecnologico

| Componente | Tecnologia |
|---|---|
| Piattaforma | Plugin Obsidian (API `obsidian` 1.12.3) |
| Linguaggio | TypeScript 4.7 |
| Ricerca full-text | MiniSearch 7.2 |
| Estrazione testo da PDF, immagini e Office | Sidecar Xberg / kreuzberg (opzionale) |
| Build | esbuild 0.17 |
| Test | Jest 29 |
| CI | GitHub Actions (build e lint su Node 20 e 22) |

## Altri documenti

- [Domain Docs](./agents/domain.md): come le skill degli agenti leggono `CONTEXT.md` e gli ADR del repo.
- [Issue tracker: GitHub](./agents/issue-tracker.md): dove stanno le issue (`faienz93/obsidian-better-finder`) e come si usano con `gh`.
- [Triage Labels](./agents/triage-labels.md): le cinque etichette di triage usate dalle skill e il loro significato.

## Documenti del progetto

- [CONTEXT.md](../CONTEXT.md): il glossario (Query, Filter, Modal, Moodboard, Data, Body, Common cache), usato in tutta la wiki e riassunto in [Architettura](./01-architettura.md). Descrive anche comportamenti non ancora nel codice, come le Occurrences parola per parola.
- [README.md](../README.md): installazione e sintassi per l'utente, riassunto in [Sintassi della query](./04-sintassi-query.md) e [CI/CD e rilascio](./05-ci-cd.md); in parte superato dal codice.
- [spec.md](../spec.md): la specifica iniziale, confrontata con il codice in [Architettura](./01-architettura.md).
- [PLAN_date_filter.md](../PLAN_date_filter.md): il piano dei filtri per data, riassunto in [Sintassi della query](./04-sintassi-query.md#date).

## Versione navigabile

[WIKI.html](./WIKI.html) contiene tutta la wiki in un file solo, con ricerca e diagrammi disegnati, e si apre senza rete.
[La mappa interattiva del sistema](./MAPPA.html) mostra moduli e dipendenze, e percorre ogni flusso passo per passo con il codice di ciascun passo.
