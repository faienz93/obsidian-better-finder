# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

This is an Obsidian plugin project written in TypeScript. Always preserve existing architectural patterns: UI components handle rendering only, controllers handle logic, and strategy patterns are used for search/filtering.

When implementing UI changes, prefer lazy-loading and IntersectionObserver patterns over pagination or result limiting. Never cap the number of displayed results unless explicitly asked.

Before making code edits, confirm the approach with the user if the task is exploratory or the user says they want to do it themselves. Watch for signals like 'faccio io' or minimal responses.

Always run `npm run build` after making changes and check for TypeScript errors. If the build fails, fix errors before committing.

When adding support for new file types (pdf, canvas, base, json), ensure both preview/thumbnail rendering AND search indexing are updated together.

### Core data flow

```
User types in FinderModal or FinderView
  → FinderCore.search() (debounced 150ms)
    → SearchStrategyFactory extracts filters from query text
    → Each matched strategy filters TFile[]
    → Remaining free text → SearchIndex.search() (MiniSearch) or fallback
    → Returns SearchResult[] (TFile | Command)
  → UI renders via SuggestModal or Card components
```

### Key modules

| File                    | Role                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `main.ts` (root)        | Plugin lifecycle, registers commands/view, owns `SearchIndex` singleton            |
| `src/FinderCore.ts`     | Search orchestration, hint rendering, debounce, result selection                   |
| `src/SearchStrategy.ts` | All filter strategies + `SearchStrategyFactory` singleton                          |
| `src/SearchIndex.ts`    | MiniSearch wrapper (singleton); builds/maintains full-text index of markdown files |
| `src/FinderModal.ts`    | `SuggestModal` UI — the keyboard-driven search popup                               |
| `src/FinderView.ts`     | `ItemView` (sidebar panel) using `Card` components                                 |
| `src/component/Card.ts` | Reusable UI components: `Card`, `SearchBar`, `ToggleButton`                        |
| `src/FinderSetting.ts`  | Settings tab (currently only ribbon icon toggle)                                   |
| `src/const.ts`          | i18n strings and emoji constants                                                   |

### Strategy pattern (`SearchStrategy.ts`)

Each query modifier is a strategy implementing `SearchStrategyInterface<T>`:

- `extract(query)` → parses the relevant token(s) from query text
- `removeFrom(query)` → strips those tokens, leaving free text for full-text search
- Strategies that also implement `Filterable<T>` have a `filter(files, extracted, app)` method

Registered strategies: `tag` (#hashtag), `dateFilter` (today/this week/this month), `fileTypes` (pdf/image/canvas/json/base), `title` (title: prefix), `task` (task:/task-todo:/task-done:), `command` (> prefix).

The `>` prefix triggers **command mode** — `FinderCore.getCommandSuggestions()` returns `Command[]` instead of `TFile[]`. The `isCommand()` / `isFile()` type guards in `FinderCore.ts` discriminate between `TFile` and `Command` results downstream.

### SearchIndex singleton

`SearchIndex` is a lazy singleton initialized in `main.ts` after layout is ready. It indexes only markdown files with MiniSearch (basename weighted 5×, content truncated to 10 000 chars). The index is kept live via vault events (`create`, `delete`, `rename`) and `metadataCache.on('changed')` registered in `main.ts`.

When the index is not ready (or free text search is over non-markdown files), `searchFilesWithoutIndex()` is used as fallback (slower, scans file content directly).

## Coding conventions

- **Singletons** via `getInstance()`: `SearchStrategyFactory` and `SearchIndex` — never instantiate them with `new`.
- ESLint enforces blank lines around `return`, `block-like` statements, and variable declarations — follow the existing pattern.
- `@typescript-eslint/no-explicit-any` is a warning, not an error; Obsidian's private APIs (`app.commands`, `app.hotkeyManager`) are accessed via `as any` intentionally.
- The `i18n` object in `src/const.ts` contains Italian UI strings — keep new strings there.
- `src/settings.ts` is a **dead file** from the sample template; the actual settings class is `src/FinderSetting.ts`.
