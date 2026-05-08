# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Whenever working with any third-party library or something similar, you MUST look up the official documentation to ensure that you're working with up-to-date information. Use the DocsExplorer subagent for efficient documentation lookup.

## Commands

```bash
npm run dev          # Development build with watch mode (uses esbuild)
npm run build        # Production build (runs tsc type-check + esbuild)
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier format
npm run format:check # Prettier check (CI)
npm run version      # Bump version and stage manifest.json + versions.json
```

There are no automated tests. Manual testing requires running `npm run dev`, enabling the plugin in Obsidian, and exercising the UI.

## Architecture

The plugin is a TypeScript Obsidian plugin bundled to `main.js` via esbuild. The real entry point is `main.ts` (root), which instantiates `SearchIndex`, registers commands/views, and wires vault events. `src/main.ts` is an **unused sample file** left from the template — ignore it.

Always preserve existing architectural patterns: UI components handle rendering only, controllers handle logic, and strategy patterns are used for search/filtering.

When implementing UI changes, prefer lazy-loading and IntersectionObserver patterns over pagination or result limiting. Never cap the number of displayed results unless explicitly asked.

Before making code edits, confirm the approach with the user if the task is exploratory or the user says they want to do it themselves. Watch for signals like 'faccio io' or minimal responses.

Always run `npm run build` after making changes and check for TypeScript errors. If the build fails, fix errors before committing.

When adding support for new file types (pdf, canvas, base, json), ensure both preview/thumbnail rendering AND search indexing are updated together.

### Two parallel UIs

The plugin exposes two independent UIs that share the same search engine:

- **`FinderModal`** (`src/FinderModal.ts`) — `SuggestModal` popup, keyboard-driven. Renders results via `ModalUI` → `SuggestionItem`.
- **`FinderCard`** (`src/FinderCard.ts`) — `ItemView` sidebar panel with grid/list toggle. Renders results via `CardUI` (`GridCard` / `ListCard`). Considered legacy by the maintainer; do not extend it without explicit ask.

Both are registered in `main.ts` and both call into the same `Finder` orchestrator.

### Core data flow

```
User types in FinderModal or FinderCard
  → Finder.search() (debounced 150ms)
    → SearchStrategyFactory extracts filters from query text
    → Each matched strategy filters TFile[]
    → Remaining free text → SearchIndex.search() (MiniSearch) or fallback
    → Returns SearchResult[] (TFile | Command)
  → UI renders via SuggestionItem (modal) or Card components (sidebar)
```

### Key modules

| File                                | Role                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `main.ts` (root)                    | Plugin lifecycle, registers commands/view, owns `SearchIndex` singleton            |
| `src/Finder.ts`                     | Search orchestration, debounce, command suggestions, result selection              |
| `src/SearchUIHelper.ts`             | Hint bar / sub-hint / tag preview wiring shared by both UIs                        |
| `src/engine/SearchStrategy.ts`      | All filter strategies + `SearchStrategyFactory` singleton                          |
| `src/engine/SearchIndex.ts`         | MiniSearch wrapper (singleton); full-text index of markdown files                  |
| `src/engine/search-filters/`        | Individual strategy implementations split by concern                               |
| `src/FinderModal.ts`                | `SuggestModal` UI — keyboard-driven popup                                          |
| `src/FinderCard.ts`                 | `ItemView` sidebar panel (legacy)                                                  |
| `src/component/Modal/ModalUI.ts`    | Renders a single suggestion in the modal — pure renderer, no logic                 |
| `src/component/Card/`               | `CardUI`, `GridCard`, `ListCard` — sidebar result rendering                        |
| `src/component/interface/Card.ts`   | Shared data interface for items rendered by both UIs                               |
| `src/component/ui/`                 | Reusable atoms: `SuggestionItem`, `Title`, `Tags`, `ImagePreview`, `HintBar`, …    |
| `src/FinderSetting.ts`              | Settings tab (currently only ribbon icon toggle)                                   |
| `src/const.ts`                      | i18n strings and emoji constants                                                   |

### Strategy pattern (`src/engine/SearchStrategy.ts`)

Each query modifier is a strategy implementing `SearchStrategyInterface<T>`:

- `extract(query)` → parses the relevant token(s) from query text
- `removeFrom(query)` → strips those tokens, leaving free text for full-text search
- Strategies that also implement `Filterable<T>` have a `filter(files, extracted, app)` method

Registered strategies: `tag` (#hashtag, hierarchical), `dateFilter` (today/this week/this month), `fileTypes` (pdf/image/canvas/json/base), `title` (title: prefix), `task` (task:/task-todo:/task-done:), `command` (> prefix).

The `>` prefix triggers **command mode** — `Finder.getCommandSuggestions()` returns `Command[]` instead of `TFile[]`. The `isCommand()` / `isFile()` type guards in `Finder.ts` discriminate between `TFile` and `Command` results downstream.

### SearchIndex singleton

`SearchIndex` is a lazy singleton initialized in `main.ts` after layout is ready. It indexes only markdown files with MiniSearch (basename weighted 5×, content truncated to 10 000 chars). The index is kept live via vault events (`create`, `delete`, `rename`) and `metadataCache.on('changed')` registered in `main.ts`.

When the index is not ready (or free text search is over non-markdown files), `searchFilesWithoutIndex()` is used as fallback (slower, scans file content directly).

### CSS architecture

CSS lives next to its component (`*.css` alongside `*.ts`) and is `import`-ed from the `.ts`. esbuild bundles all imports into `main.css`, which the `renameCssPlugin` in `esbuild.config.mjs` renames to `styles.css` (the only file Obsidian auto-loads). Do not edit `styles.css` by hand — it's a build artifact.

The `.better-finder-modal` class is **not** added by Obsidian — `FinderModal.onOpen()` calls `this.modalEl.addClass('better-finder-modal')` to scope modal-specific CSS. If you write new CSS rules scoped to that class, they only apply if the modal is open.

### Preview rendering policy

Decision of "should this file get a thumbnail preview?" lives in `FinderModal.renderResult()`, not in `ModalUI`. The modal builds an optional `renderPreview: (el) => void` callback (using `ImagePreview`) and passes it as an optional field on `Card`. `ModalUI` is a dumb renderer that calls `setPreview(renderPreview)` only if the field is defined.

`ImagePreview` (`src/component/ui/ImagePreview.ts`) handles four cases internally: Excalidraw (frontmatter `excalidraw-plugin: parsed`), `.md` text snippet, `.json` code preview, and any other extension via `MarkdownRenderer.render('![[…]]')` embed.

## Obsidian API — inherited methods

When extending an Obsidian class, always use the exact method names required by the installed API version. Never rename abstract methods, even if the name seems unusual. Always check the TypeScript compiler error: if it reports an abstract method as not implemented, use exactly the name indicated in the error.

Known cases:

- `SuggestModal<T>` requires `renderModalItem(result: T, el: HTMLElement)` (not `renderSuggestion`)

## Coding conventions

- **Singletons** via `getInstance()`: `SearchStrategyFactory` and `SearchIndex` — never instantiate them with `new`.
- ESLint enforces blank lines around `return`, `block-like` statements, and variable declarations — follow the existing pattern.
- `@typescript-eslint/no-explicit-any` is a warning, not an error; Obsidian's private APIs (`app.commands`, `app.hotkeyManager`) are accessed via `as any` intentionally.
- The `i18n` object in `src/const.ts` contains Italian UI strings — keep new strings there.
- `src/settings.ts` is a **dead file** from the sample template; the actual settings class is `src/FinderSetting.ts`.
- Plans for non-trivial tasks live in `.claude/plans/` (created via the `ping-pong-task` skill).
