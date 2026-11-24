# Better Finder

An Obsidian plugin that searches a vault from a single text box: the user types one string that mixes
filters and free words, and gets back notes, attachments and Obsidian commands.

## Language

### What the user types

**Query**:
The single string the user types into the search box. It mixes filters and free text; there is no
separate "advanced search" form.
_Avoid_: search string, input, term

**Filter**:
A token inside a query that narrows results by a property rather than by words: a `#tag`, a
`key:value` such as `path:`, `task:` or `modified:`, a bare keyword such as `pdf` or `image`, or one
of these negated with `-`. Every filter recognises its own tokens, by their shape rather than by
their position in the query, and owns the narrowing it performs. A `key:value` whose key no filter
claims is read as a frontmatter property.
_Avoid_: strategy, modifier, operator, facet

**Free text**:
The words of the query that no filter recognises. This is the part matched against titles and
content.
_Avoid_: query rest, remainder, keywords

**Command mode**:
The state a query enters when it starts with `>`, where results are Obsidian commands to run instead
of files to open.
_Avoid_: palette mode, action mode

**Negation**:
A filter token prefixed with `-` that excludes matches instead of requiring them.
_Avoid_: exclusion filter, NOT filter, blacklist

**Scope**:
Whether free text is matched against titles only or against full content. Narrowed to titles by the
`title:` filter.
_Avoid_: search field, target

**Filter bar**:
The row of Filter chips above the results, one per Filter.
_Avoid_: hint bar, toolbar

**Filter chip**:
A control in the Filter bar that stands for one Filter. It lights up while the query uses that
Filter, in any form, even half typed. Clicking it when unlit adds the Filter to the query; clicking
it when lit removes every token of that Filter, values included.
_Avoid_: hint, button, tag

**Value chip**:
A control that offers one value for a Filter, such as `today` or `this-week` for a date Filter, or a
colour for the highlight filter. Clicking it when unlit applies that value; clicking it when lit
removes it but keeps the Filter. A Filter takes one value at a time (a date replaces the previous
one) or several (colours add up).
_Avoid_: sub-hint, filter value

### What comes back

**Result**:
One item the search returns: either a vault file or an Obsidian command. The two kinds travel
together through the search and are told apart only when rendered.
_Avoid_: hit, match, entry

**Superseded search**:
A search whose query is no longer what the user has typed. Its results are never shown, even if it
finishes after a newer search.
_Avoid_: stale search, cancelled search, abandoned search

**Modal**:
The floating search popup, driven from the keyboard, that closes once a result is opened.
_Avoid_: popup, palette, finder

**Moodboard**:
The search view that opens as a workspace tab and lays results out either as a grid of Cards or as
a List. It stays open while results are opened from it.
_Avoid_: sidebar, board, panel, card view

**Data**:
What is known about one result for the purpose of showing it: its tags and which of them the query
asked for, its task count, what its Body shows. It is decided once per result and query, and every
Card and Item draws it the same way. What a result shows is decided by the query as a whole, so a
query with both a tag and a task filter shows both.
_Avoid_: view model, card, item

**Card**:
The square that draws one result's Data in the Moodboard grid.
_Avoid_: tile

**Item**:
The line that draws one result's Data in a List: a row of the Modal, or a row of the Moodboard in
list layout.
_Avoid_: card, suggestion, row

**List**:
A column of Items. The Modal always shows a List; the Moodboard shows one when switched out of grid
layout.
_Avoid_: list view, table

**Preview**:
What a file is, drawn in the Body: an image, an embed, a text excerpt or a code excerpt, depending on
the file type. Not every file type has one. A note found by free text shows its Occurrences instead,
and the Card offers a button to switch to the Preview and back.
_Avoid_: thumbnail

**Body**:
The part of a Card or an Item below the title. It shows what the Data chose for that result: its
Occurrences, its task lines, its Highlights, its Preview, or nothing. With free text and a task or
highlight filter it shows them together, Highlights and task lines first, never the same line twice.
_Avoid_: content, preview area

**Occurrences**:
Every place in a note's content where a searched word appears, each with a few words of context and
the word highlighted, like `grep` with context. Each word of the free text is looked for on its own,
including the near spellings and prefixes the search accepted. Nearby occurrences merge into one
passage. It explains why the result matched; a Preview only shows what the file is.
_Avoid_: snippet, excerpt, highlight, match

**Highlight**:
Text the user marked in a note with `==…==`, Obsidian's own word for it. A Highlight lies within one
line and has a colour: one of six the user picks (red, orange, yellow, green, blue, purple) or the
theme's default. With the highlight filter the Body shows a note's Highlights the way it shows
Occurrences: the marked text in its colour, with a few words of context. Not to be confused with an
Occurrence, which is a searched word the Body marks.
_Avoid_: mark, evidenziazione

### What is searched

**Vault**:
The user's Obsidian folder: the full set of files Better Finder can return. Obsidian's own word, kept
deliberately.
_Avoid_: workspace, library, corpus

**Index**:
The pre-built full-text structure that makes content search fast. It covers markdown plus whatever
text has been extracted from attachments; files outside it are searched by reading them directly.
_Avoid_: cache, database, search engine

**Extraction**:
Pulling readable text out of a file that has none in its markdown form: text from PDFs, OCR from
images, content from Office documents. Extracted text becomes indexable like any note.
_Avoid_: parsing, scraping, ingestion

**Sidecar**:
An external executable the plugin shells out to for work it cannot do itself, currently extraction.
Absent sidecars degrade the feature rather than break the plugin.
_Avoid_: binary, helper, backend, CLI tool

**Common cache**:
State derived from the Vault that must be kept current as files change. The Index, the canvas tag
lookup and the extraction store are the three that exist; each one decides which files it holds.
_Avoid_: projection, store, index (the Index is one common cache, not the category)

**Staleness**:
A common cache entry disagreeing with the file it was derived from, detected by comparing modified
times. How a cache answers a read while stale is its own choice, not a shared rule — see below.

## Deliberate asymmetry

The three common caches agree on how they are kept current — one interface, four events — and
disagree on how they answer a read while stale. That split is a decision, not an oversight:

- **Canvas tags** answer synchronously, returning the stale tags and refreshing in the background,
  because a Filter reads them mid-search and cannot await.
- **The Index** does not check staleness on read at all; events keep it current.
- **Extraction** checks on extract, because re-running a sidecar is expensive.

Unifying these would force either an async Filter or a synchronous model that extraction cannot
honour. Treat a proposal to make them uniform as a change to this decision.
