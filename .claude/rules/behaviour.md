# Behaviour rules

How to work in this repo. Git-specific rules live in [commit.md](./commit.md).

## Don't touch what you weren't asked to touch

- **Never delete marker comments** — `// TODO`, `// FIXME`, `// ANCHOR`, `// FIX`, `// NOTE` and
  the like — even when they look stale or already resolved. They are deliberate anchors for a
  future pass.

- **Never rename an identifier without explicit approval**: variables, functions, methods,
  TypeScript types, DB columns, object keys, route names, file names. If you think a name could be
  better, **propose** it in your reply and leave the code alone. This covers cosmetic refactors too
  — normalising casing (camelCase ↔ snake_case) or aligning names to a convention is still a
  rename.

## Comments

- **Always in English.** Comments, docstrings, `describe`/`it` descriptions, error messages — in
  every code file: `.ts`, `.tsx`, `.sh`, migrations, tests.

  ⚠️ Some files carry Italian comments from earlier work. They are **not** a precedent; don't
  imitate them. The conversation itself stays in Italian.

- **One or two sentences, not an essay.** A comment says *why* a line is the way it is, not how it
  was found. No reproduction history, no multi-line sample payloads, no dates.

  Long context — how a bug surfaced, what was tried, the numbers measured — belongs in a plan under
  `.claude/plans/` or in memory. In the source it rots and nobody updates it.

  ```ts
  // NO
  // QA test for the ownership of a bizz row on the UPDATE path.
  // The route is POST /api/bizz/:table/:document, and the server resolves the Serv_ID...
  // (12 more lines of context, the curl reproduction, and the date)

  // YES
  // rowId is an IDENTITY of the table, not of the asset: scoping on it alone would let a
  // caller rewrite another asset's row.
  ```

## Formatting

- **Follow `.editorconfig`** whenever you create or modify a file.

  ⚠️ Watch for diffs inflated by line endings. If a diff explodes across a whole file — a few real
  lines changed but `git diff` shows hundreds — the cause is almost always an EOL switch. Check
  with `git diff --ignore-cr-at-eol` to see the real changes, and match the file's existing EOLs
  rather than reintroducing noise. **Don't** convert a whole file to "normalise" it.

## Replies

- Always use the `stop-slop` skill when replying.
