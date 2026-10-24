# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Whenever working with any third-party library or something similar, you MUST look up the official documentation to ensure that you're working with up-to-date information. Use the `docs-explorer:docs-explorer` subagent (from the dev-toolbox plugin) for efficient documentation lookup.

## Language

The plugin will be published. Everything that lands in the repo or on GitHub is written in English: code, comments, commit messages, issues, specs, docs. Older files still carry Italian comments; they are not a precedent. The conversation with the maintainer stays in Italian. UI strings are the exception: they live in the `i18n` object in `src/const.ts`.

## Domain language

`CONTEXT.md` is the glossary. Use its terms in code, issues and replies, and the words it lists under _Avoid_ nowhere. The ones that are easy to get wrong:

- **Modal**: the floating popup (`FinderModal`). **Moodboard**: the view that opens as a workspace tab (`FinderMoodboard`). Never call it "sidebar": it is not one.
- **Data**: what is decided about one result for display. **Card** (Moodboard grid square), **Item** (row of a List, in the Modal or the Moodboard list layout) and **List** are the graphic components that draw it.
- **Body**: the part of a Card or Item below the title. **Occurrences**: every place a searched word appears, with context (formerly "snippet"). **Preview**: what the file is (image, embed, excerpt).

In code the Data interface is still named `Card` (`src/component/interface/Card.ts`) until the work in issue #2 renames it `ResultData`.

## Commands

```bash
npm run dev          # Development build with watch mode (esbuild)
npm run build        # Production build: tsc type-check + esbuild
npm test             # Jest unit tests
npx jest test/search-filters.test.ts   # One test file
npx jest -t "part of a test name"      # Tests matching a name
npm run lint         # ESLint
npm run lint:fix
npm run format       # Prettier
npm run format:check
npm run version      # Bump version, stage manifest.json + versions.json
```

Always run `npm run build` after a change and fix TypeScript errors before committing.

Tests run in Node without Obsidian: `jest.config.js` maps `obsidian` and `minisearch` to the mocks in `test/mocks/`, and CSS imports to a stub. Tests build a fake `App` (metadata cache keyed by path, `cachedRead` over an in-memory map) and reset singletons through their private static field. Anything that touches the DOM is checked by hand: `npm run dev`, enable the plugin in Obsidian (the Hot Reload plugin reloads it on rebuild), exercise both the Modal and the Moodboard.

## Architecture

TypeScript Obsidian plugin bundled to `main.js` by esbuild. The entry point is the root `main.ts`. `src/main.ts` and `src/settings.ts` are untouched leftovers of the sample template: ignore them. The settings tab is `src/FinderSetting.ts`.

### Two views, one search

- **Modal** (`src/FinderModal.ts`): a `SuggestModal`, keyboard-driven, closes on open. Draws Items via `ModalUI` → `ModalItem`.
- **Moodboard** (`src/FinderMoodboard.ts`): an `ItemView` opened in a new workspace tab, grid or list layout, stays open while results open in new tabs. Draws via `CardUI` → `GridCard` / `ListCard`. It is being extended (issue #2); the old "legacy, do not extend" rule no longer applies.

Both go through the same pipeline:

```
Query typed in Modal or Moodboard
  → LatestSearch.run()        one per view: 150 ms debounce, only the latest search settles
    → Finder.getResults()
      → SearchStrategyFactory.parse()        Query → ParsedQuery
      → SearchStrategyFactory.filter()       each Filter narrows TFile[]
      → filterFreeText()                     Index (MiniSearch) or direct file scan
    → SearchResult[]  (TFile | Command; isCommand()/isFile() tell them apart)
  → view builds the Data per result and draws it
```

A superseded search never resolves: `SuggestModal` applies whatever promise resolves, without checking the query, so resolving or rejecting a stale one would show wrong results. See the JSDoc of `LatestSearch`.

### Filters

Each Filter is a class in `src/engine/search-filters/` extending `SearchFilter<T>`: `extract(query)` parses its token, `removeFrom(query)` strips it, `filter(files, extracted, app)` narrows, and `label`/`desc` feed the hint bar. Adding a Filter still means registering it by hand in `search-filters/index.ts`, `types.ts` (`ParsedQuery`) and in both `parse()` and `filter()` of `SearchStrategyFactory`, whose order is written out in the method bodies; collapsing that into one ordered registry is candidate 1 of `docs/architecture-review-2026-10-09.html`. `>` at the start of the Query switches to command mode. Tag matching is hierarchical: `#project` matches `#project/alpha` (`matchesTag`).

### Common caches

Three singletons derive state from the Vault and implement `CommonCache` (`src/engine/CommonCache.ts`): `SearchIndex` (MiniSearch over markdown plus extracted text, basename weighted 5×, content truncated to 10 000 chars), `CanvasTagCache` (tags inside canvas text nodes, which the metadata cache does not see) and `XbergExtractor` (PDF text and image OCR through the `xberg`/`kreuzberg` sidecar binary, persisted to `xberg-cache.json`; disabled when the binary is missing). `main.ts` builds them in `onLayoutReady` and dispatches every vault event to each cache whose `handles(file)` is true. A new cache is one more entry in that list.

They agree on how they stay current and deliberately disagree on how they answer a read while stale; `CONTEXT.md` explains why. Do not unify them.

When the Index is not ready, or free text runs over non-markdown files, `searchFilesWithoutIndex()` reads files directly.

### Preview

"Does this file get a Preview?" has one answer: `ImagePreview.hasPreview(app, file, { hasSnippet })`, next to the branches of `ImagePreview.load()` that draw it. `ImagePreview` draws a `.md` text excerpt, a `.json` code excerpt, an icon plus extracted text for docx/xlsx, and an `![[…]]` embed for images, canvas, pdf and Excalidraw (`excalidraw-plugin: parsed` in frontmatter). Rendering markdown runs every other plugin's post-processors (execute-code, mermaid, …), which is costly on long lists.

### CSS

CSS sits next to its component and is imported from the `.ts`. esbuild bundles it into `main.css`, which `renameCssPlugin` in `esbuild.config.mjs` renames to `styles.css`, the only file Obsidian loads. Never edit `styles.css` by hand. The `.better-finder-modal` class is added by `FinderModal.onOpen()`, not by Obsidian.

## Obsidian API pitfalls

- Use the exact abstract method names the installed API requires, even odd ones; trust the compiler error. `SuggestModal<T>` requires `renderModalItem(result, el)`, not `renderSuggestion`.
- `FINDER_VIEW_TYPE` (`"better-finder-view"`) is stored in saved workspace layouts. Never change it, even when renaming the view class.
- Private APIs (`app.commands`, `app.hotkeyManager`) are reached through `as any` on purpose; `no-explicit-any` is a warning.

## Coding conventions

- Singletons (`SearchStrategyFactory`, `SearchIndex`, the common caches) are obtained with `getInstance()`, never `new`.
- ESLint enforces blank lines around `return`, block statements and variable declarations; follow the existing pattern.
- How to behave and how to commit are in `.claude/rules/behaviour.md` and `.claude/rules/commit.md`.
- Reviews apply `CODING_STANDARDS.md`: where logic lives, one function per question about a file, domain names, uncapped lazy results.

## Agent skills

### Issue tracker

Issues live as GitHub issues on `faienz93/obsidian-better-finder`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical labels, unrenamed: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the plugin root. See `docs/agents/domain.md`.
