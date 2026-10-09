# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root (the plugin root, i.e. the folder holding `manifest.json`).
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

This is a **single-context** repo. Domain docs live at the plugin root, alongside `CLAUDE.md`:

```
.obsidian/plugins/obsidian-better-finder/
├── CLAUDE.md
├── CONTEXT.md                         ← glossary
├── docs/
│   ├── agents/                        ← this config
│   └── adr/                           ← decisions (created lazily)
├── main.ts
└── src/
```

`CONTEXT.md` holds the glossary. `docs/adr/` does not exist yet: `/domain-modeling` creates an
ADR only when a decision is hard to reverse, surprising without context, and the result of a real
trade-off.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
