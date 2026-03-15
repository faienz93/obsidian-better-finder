# Piano implementato: Date Filter con prefisso+suffisso

## Obiettivo

Sostituire i filtri data piatti (`today`, `this week`, `this month`) con una sintassi
`modified:VALUE` / `created:VALUE`, dove VALUE è uno di `today`, `yesterday`, `this-week`, `this-month`.

La UI mostra prima i chip principali (`modified:`, `created:`), poi — quando uno è presente
nella query — mostra una seconda riga di **subhint chip** con i valori possibili.

---

## Scelte architetturali

### 1. Tipo `DateRange` da stringa a oggetto strutturato

**Prima:** `DateRange = 'today' | 'this-week' | 'this-month'`

**Dopo:** `DateRange = { field: DateField; value: DateValue }`

dove `DateField = 'modified' | 'created'` e `DateValue = 'today' | 'yesterday' | 'this-week' | 'this-month'`.

**Perché:** il vecchio tipo non portava informazione sul campo da filtrare (mtime vs ctime).
Con l'oggetto strutturato, `filter()` sa esattamente su quale stat agire e con quale range temporale,
senza bisogno di dispatching esterno.

---

### 2. `subHints?` in `SearchFilter` (base class)

Aggiunto `readonly subHints?: HintsType[]` come campo opzionale in `SearchFilter<TResult>`.

**Perché:** i subhint sono dati della strategia stessa, non della UI. Centralizzare qui permette
alla UI (`FinderModal`, `FinderCard`) di interrogare la strategia e ottenerli senza hardcoding.
Le strategie che non hanno subhint (tag, title, task, ecc.) ignorano semplicemente il campo.

---

### 3. Due classi `ModifiedFilter` e `CreatedFilter` al posto di tre classi piatte

**Prima:** `TodayFilter`, `ThisWeekFilter`, `ThisMonthFilter` — tre classi, stessa logica di base,
ognuna riconosceva tutti e tre i pattern e restituiva una stringa.

**Dopo:** `ModifiedFilter` e `CreatedFilter` — due classi, stessa logica di base condivisa
via `abstract class DateFilter`. Ogni classe riconosce il proprio prefisso (`modified:` / `created:`)
seguito da qualsiasi dei quattro valori.

**Perché:** la granularità non è più "quale range temporale" ma "quale campo + quale range".
Due classi corrispondono esattamente ai due chip principali nella UI.

**Regex usata:** `/\bmodified:(today|yesterday|this-week|this-month)\b/`

`removeFrom()` rimuove anche il prefisso nudo (`modified:` senza valore) così non finisce
nel free text quando l'utente ha digitato il prefisso ma non ancora il valore.

---

### 4. `SearchStrategyFactory`: strategyMap con chiavi `'modified'` e `'created'`

Le chiavi nella map sono `'modified'` e `'created'` (senza i due punti), così
`getStrategy('modified')` funziona nel `parse()` e nel `filter()`.

Nel `filter()`: si usa `parsed.dateFilter.field` come chiave per recuperare la strategia giusta
dalla map — non più hardcoded su `'today'`.

Nel `parse()`: si provano entrambe le strategie; se nessuna ha estratto un risultato completo
(prefisso+valore), si chiama comunque `removeFrom()` su entrambe per pulire eventuali prefissi
nudi dal remaining text prima del free text search.

---

### 5. `HintBar`: doppia barra con `showSubHints` / `hideSubHints`

Aggiunto un secondo `HTMLElement` (`subHintBar`) creato nel costruttore, nascosto di default
(`display: none`). I metodi pubblici:

- `showSubHints(subHints, onClick)` — svuota e ripopola la subHintBar, la rende visibile
- `hideSubHints()` — nasconde e svuota
- `highlightSubChips(activeLabels)` — evidenzia il chip del valore attivo (es. `today`)

**Perché non riusare `addHint`:** i subhint sono temporanei e cambiano in base al prefisso
attivo; i chip principali sono permanenti. Mantenere i due set separati evita di mescolare
stato e semplifica il clear.

---

### 6. `Finder`: tre nuovi metodi

- `getActiveDatePrefix(query)`: restituisce `'modified:'` o `'created:'` se presenti nella query
  (con regex `/\bmodified:/`), altrimenti `undefined`. Usato per decidere se mostrare i subhint.
- `getActiveSubHints(query)`: fa parse della query e restituisce il valore attivo (es. `['today']`)
  per evidenziare il subhint chip corretto.
- `getSubHintsForPrefix(prefix)`: estrae la strategia dalla factory tramite chiave (rimuovendo
  i due punti), restituisce i suoi `subHints`. Fa da bridge tra UI e strategie.

---

### 7. `FinderModal` e `FinderCard`: gestione subhint

Sull'evento `input`:
1. `getActiveDatePrefix(query)` — c'è un prefisso attivo?
2. Se sì: `showSubHints(...)` con callback che sostituisce nella query il token
   `prefix+oldValue` (o solo `prefix`) con `prefix+newValue` via regex, poi appende uno spazio.
3. Se no: `hideSubHints()`

Il click su subhint usa una regex per sostituire in-place il token data esistente nella query,
evitando duplicati (es. passare da `modified:today` a `modified:this-week` funziona correttamente).

---

## File modificati

| File | Tipo di cambiamento |
|------|---------------------|
| `src/const.ts` | Aggiunte stringhe i18n: `yesterday`, `modified`, `created` |
| `src/engine/search-filters/types.ts` | Nuovi tipi `DateField`, `DateValue`, `DateRange`; `subHints?` in `SearchFilter` |
| `src/engine/search-filters/DateFilter.ts` | Riscritto: `ModifiedFilter` + `CreatedFilter`, supporto `yesterday`, filtro su `mtime`/`ctime` |
| `src/engine/search-filters/index.ts` | Export aggiornati (rimossi vecchi, aggiunti nuovi) |
| `src/engine/SearchStrategy.ts` | `strategyMap`, `parse()`, `filter()` aggiornati |
| `src/component/ui/HintBar.ts` | Aggiunto `subHintBar`, `showSubHints`, `hideSubHints`, `highlightSubChips` |
| `src/Finder.ts` | Aggiunti `getActiveDatePrefix`, `getActiveSubHints`, `getSubHintsForPrefix` |
| `src/FinderModal.ts` | Gestione subhint sull'evento input + click |
| `src/FinderCard.ts` | Stessa gestione subhint per la sidebar |

---

## Comportamento atteso

1. Apertura modal/sidebar → chip `modified:` e `created:` visibili nella hint bar principale
2. Digitare `modified:` → appare seconda riga con chip `today / yesterday / this-week / this-month`
3. Click su `today` → query diventa `modified:today ` → risultati filtrati per file modificati oggi
4. Passare da `modified:today` a `modified:this-week` → sostituzione in-place, nessun duplicato
5. `created:this-week` → filtra per `file.stat.ctime` invece di `mtime`
6. Free text funziona combinato: `modified:today react` → filtra per data E full-text search
7. Rimuovere il prefisso dalla query → subhint spariscono, tutti i file visibili
