# Piano: Date Filter con prefisso `modified:` / `created:`

## Obiettivo

Sostituire i filtri data piatti (`today`, `this week`, `this month`) con la sintassi
`modified:VALUE` / `created:VALUE`, dove VALUE è uno tra:
`today`, `yesterday`, `this-week`, `last-week`, `this-month`, oppure una data assoluta
nei formati `YYYY-MM-DD` o `YYYY/MM/DD`.

La UI mostra prima i chip principali (`modified:`, `created:`), poi — quando uno è presente
nella query — mostra una seconda riga di **subhint chip** con i valori possibili.

---

## Architettura

### 1. Tipi (`src/engine/search-filters/types.ts`)

Sostituire:

```ts
// VECCHIO
export type DateRange = 'today' | 'this-week' | 'this-month';
```

Con:

```ts
export type DateField = 'created' | 'modified';
export type DateValue = 'today' | 'yesterday' | 'this-week' | 'last-week' | 'this-month' | string; // string = data assoluta
export type DateRange = { field: DateField; value: DateValue };
```

Aggiornare `ParsedQuery`:

```ts
// VECCHIO
dateFilter?: 'today' | 'this-week' | 'this-month';
// NUOVO
dateFilter?: DateRange;
```

---

### 2. Filter (`src/engine/search-filters/DateFilter.ts`)

- **Eliminare** le classi `TodayFilter`, `ThisWeekFilter`, `ThisMonthFilter` e la classe astratta `DateFilter`
- **Creare** due nuove classi concrete `ModifiedFilter` e `CreatedFilter` che estendono `SearchFilter<DateRange | undefined>`:
  - `extract(query)` cerca il pattern `modified:VALUE` o `created:VALUE` rispettivamente
  - `removeFrom(query)` rimuove il token estratto dalla query
  - `filter(files, dateRange, app)` usa `file.stat.mtime` (ModifiedFilter) o `file.stat.ctime` (CreatedFilter)
  - I risultati sono ordinati dal più recente al meno recente
- Valori supportati: `today`, `yesterday`, `this-week`, `last-week`, `this-month`, `YYYY-MM-DD`, `YYYY/MM/DD`
- `last-week`: dal lunedì precedente alla domenica (settimana completa passata), last month dal primo del mese precedente al 31 del mese precedente etc..

---

### 3. Index (`src/engine/search-filters/index.ts`)

- Rimuovere export di `TodayFilter`, `ThisWeekFilter`, `ThisMonthFilter`
- Aggiungere export di `ModifiedFilter`, `CreatedFilter`

---

### 4. SearchStrategy (`src/engine/SearchStrategy.ts`)

- Rimuovere import e registrazione di `TodayFilter`, `ThisWeekFilter`, `ThisMonthFilter`
- Aggiungere registrazione di `ModifiedFilter` (chiave `'modified'`) e `CreatedFilter` (chiave `'created'`)
- Nel metodo `parse()`: sostituire il blocco "Extract date filters" con chiamate a entrambe le strategy; i due filtri sono mutuamente esclusivi — se l'utente scrive `modified:today created:yesterday` vince il primo trovato
- Nel metodo `filter()`: usare la chiave `parsed.dateFilter.field` per scegliere quale strategy applicare

---

### 5. Costanti (`src/const.ts`)

- Rimuovere `today`, `thisWeek`, `thisMonth`
- Aggiungere `modified` e `created` (label per i chip della HintBar)

---

### 6. SubHintBar (`src/component/ui/SubHintBar.ts`) — file nuovo

Classe standalone (non dentro `HintBar`), con visibilità controllata dall'esterno.

```ts
export class SubHintBar {
  constructor(parentEl: HTMLElement, onClick: (value: string) => void);
  show(activeValue?: string): void; // mostra la barra, evidenzia activeValue se presente
  hide(): void; // nasconde la barra
}
```

I chip fissi mostrati sono: `today`, `yesterday`, `this-week`, `last-week`, `this-month`.
Il click su un chip appende il valore alla query corrente (es. se la query è `modified:` il click su `today` completa in `modified:today`).

**Colori**: i chip `modified:` e `created:` nella HintBar principale usano lo stile standard
(`hint-chip` / `hint-chip-active`). I chip della SubHintBar hanno una classe aggiuntiva
`hint-chip-sub` per distinguerli visivamente — piccola differenza CSS, vale la pena farlo subito.

---

### 7. HintBar (`src/component/ui/HintBar.ts`)

Nessuna modifica strutturale. La `SubHintBar` è indipendente.

---

### 8. FinderModal e FinderCard — gestione SubHintBar

Ogni classe gestisce la propria `SubHintBar` in modo indipendente (duplicazione accettata per ora).
La logica è identica in entrambe: va applicata dopo ogni aggiornamento della query.

```ts
const parsed = factory.parse(query);
if (parsed.dateFilter) {
  subHintBar.show(parsed.dateFilter.value);
} else if (query.includes('modified:') || query.includes('created:')) {
  subHintBar.show(); // nessun chip attivo
} else {
  subHintBar.hide();
}
```

---

## File da modificare / creare

| File                                      | Azione                                                  |
| ----------------------------------------- | ------------------------------------------------------- |
| `src/engine/search-filters/types.ts`      | Aggiornare `DateRange`, `ParsedQuery`                   |
| `src/engine/search-filters/DateFilter.ts` | Riscrivere interamente                                  |
| `src/engine/search-filters/index.ts`      | Aggiornare export                                       |
| `src/engine/SearchStrategy.ts`            | Aggiornare import, registrazione, `parse()`, `filter()` |
| `src/const.ts`                            | Sostituire costanti date                                |
| `src/component/ui/SubHintBar.ts`          | **Creare**                                              |
| `src/FinderModal.ts`                      | Integrare SubHintBar, gestire show/hide                 |
| `src/FinderCard.ts`                       | Integrare SubHintBar (ha anch'essa una HintBar)         |

---

## Cosa NON implementare ora

- Range di date (`created:2024-01-01 2024-12-31`) — rimandato
