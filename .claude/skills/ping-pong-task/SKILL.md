---
name: ping-pong-task
description: Sessione di brainstorming ping-pong su un task specifico — esplora possibilità di implementazione, raccoglie vincoli e decisioni, e produce un plan file dentro .claude/plans/.
when_to_use: Quando l'utente vuole ragionare su un task prima di implementarlo
allowed-tools: Read, Write, Bash
---

## Obiettivo

Condurre una conversazione interattiva e iterativa con l'utente per esplorare un task prima di implementarlo. Non si scrive codice né documentazione ora — si ragiona insieme, si fanno domande, si raccolgono decisioni. Alla fine si produce un file di plan in `.claude/plans/`.

---

## Passo 1 — Identifica il task

Chiedi all'utente:

> "Su quale task vuoi fare brainstorming? Descrivilo liberamente, oppure passami un file o documento di riferimento se ne hai uno (es. un TODO, una specifica, un ticket)."

Se l'utente passa un file, leggilo prima di rispondere.

---

## Passo 2 — Prima risposta: orientamento

Analizza il task e il contesto disponibile, poi produci:

1. **Riassunto di ciò che hai capito** — cosa il task dovrebbe fare, in quale area del sistema si colloca
2. **Contesto rilevante** — se hai letto file di riferimento, evidenzia le parti che vincolano o informano questo task
3. **Prime domande aperte** — massimo 2-3 domande chiave per chiarire scope e vincoli
4. Leggi il contenuto di  `claude/plans/`. Se contiene materiale rilevante usalo nella sessione corrente

Aspetta la risposta prima di proseguire.

---

## Passo 3 — Ciclo ping-pong

Conduci la conversazione in modo iterativo. Ad ogni turno:

- **Ascolta** la risposta dell'utente e integra le nuove informazioni
- **Proponi** un'idea concreta o un'alternativa di implementazione (non solo domande)
- **Solleva un dubbio** specifico o un trade-off rilevante
- **Chiedi conferma** su una decisione presa prima di andare avanti

Regole del ciclo:
- Non mettere più di 2-3 domande per turno — meglio andare in profondità su una cosa che sparare tutto in una volta
- Alterna: a volte tu proponi, a volte tu chiedi — non fare solo interrogatorio
- Se l'utente dice "vai tu" o "cosa faresti?", proponi un approccio concreto con pro/contro
- Se emergono alternative significative, presentale chiaramente come opzioni (A vs B) e chiedi quale preferisce
- Quando una decisione è presa, confermala esplicitamente ("Ok, quindi andiamo con [X]") prima di passare al punto successivo
- Se vedi problematiche evidenti, sollevale subito senza aspettare che l'utente le scopra

Aree tipiche da esplorare (adatta al contesto del task):
- **Scope:** cosa è in e cosa è fuori da questo task?
- **Utente/attore:** chi usa questa feature e come?
- **Approccio tecnico:** quale componente la implementa? nuova logica o estensione di esistente?
- **Dipendenze:** blocca o è bloccato da altri task?
- **Edge case:** cosa succede se [scenario limite]?
- **Testabilità:** come si verifica che funzioni?
- **Rollout:** c'è una versione minima e una completa?

---

## Passo 4 — Riepilogo delle decisioni

Quando la conversazione ha raggiunto una buona maturità (l'utente smette di aggiungere vincoli, oppure lo chiede esplicitamente), produci un riepilogo strutturato:

```
## Riepilogo brainstorming — [titolo task]

**Cosa fa:** [1-3 righe descrizione chiara]

**Scope:**
- In: [cosa è incluso]
- Out: [cosa è escluso esplicitamente]

**Approccio scelto:** [descrizione dell'implementazione concordata]

**Decisioni prese:**
- [decisione 1 — motivazione breve]
- [decisione 2 — motivazione breve]

**Punti ancora aperti:**
- [domanda o incertezza non risolta]

**Dipendenze:**
- [task o componenti che devono esistere prima]
```

Poi chiedi:

> "Vuoi che produca il plan file, oppure vuoi continuare a ragionare su qualcosa?"

---

## Passo 5 — Produzione del plan file

Quando l'utente conferma, entra in **plan mode** e crea il file in `.claude/plans/`.

### Nome del file

Chiedi all'utente come vuole chiamare il file, oppure proponi un nome basato sul titolo del task (es. `.claude/plans/autenticazione-sso.md`). Aspetta conferma prima di scrivere.

### Struttura del file

Il file segue il formato plan mode standard:

```markdown
# Plan — [titolo task]

> Creato il: [data]
> Stato: draft | in progress | done

## Obiettivo

[Cosa deve essere implementato e perché — 2-4 frasi]

## Scope

**In:**
- [cosa è incluso]

**Out:**
- [cosa è escluso esplicitamente]

## Approccio tecnico

[Descrizione dell'implementazione concordata durante il brainstorming.
Componenti coinvolti, pattern scelto, motivazioni delle scelte principali.]

## Step di implementazione

- [ ] [step 1]
- [ ] [step 2]
- [ ] [step 3]
...

## Decisioni prese

| Decisione | Alternativa scartata | Motivazione |
|---|---|---|
| [scelta] | [alternativa] | [perché] |

## Punti aperti

- [ ] [domanda o incertezza ancora irrisolta]

## Dipendenze

- [task o componenti che devono esistere prima]

## Note

[Qualsiasi cosa emersa nel brainstorming che non rientra nelle sezioni precedenti]
```

### Conferma prima di scrivere

Mostra il contenuto del file all'utente **prima** di crearlo. Scrivi su disco solo dopo conferma esplicita.

### Dopo la scrittura

Comunica il path completo del file creato e suggerisci come usarlo nelle sessioni successive:

> "Plan salvato in `.claude/plans/[nome-file].md`. Nelle prossime sessioni puoi passarmelo come contesto con: `leggi .claude/plans/[nome-file].md`"

---

## Note di comportamento

- **Tono:** collaborativo, non direttivo. Tu sei il facilitatore, l'utente decide.
- **Lunghezza risposte:** brevi e focalizzate. Meglio una domanda precisa che tre vaghe.
- **Se sei incerto** su un vincolo, chiedi esplicitamente anziché assumere.
- **Non anticipare** tutta l'implementazione da solo — il valore è nella conversazione, non nel monologo.
- **Se l'utente vuole saltare** direttamente al plan file senza ciclo ping-pong, adattati senza resistenza.
