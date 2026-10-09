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
A prefixed token inside a query that narrows results by a property rather than by words, such as
`#tag`, `path:`, `task:`, `modified:` or `-pdf`. Every filter owns both the parsing of its own token
and the narrowing it performs.
_Avoid_: strategy, modifier, operator, facet

**Free text**:
Whatever is left of the query once every filter token has been removed. This is the part matched
against titles and content.
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

### What comes back

**Result**:
One item the search returns: either a vault file or an Obsidian command. The two kinds travel
together through the search and are told apart only when rendered.
_Avoid_: hit, match, entry

**Card**:
The view-model describing how a single result should be displayed: its tags, which of those tags the
query asked for, task counts, and whether it gets a preview. It is what the search layer hands to a
UI, not a visual element itself.
_Avoid_: item, row, tile, view model

**Preview**:
The visual rendering of a result's content shown next to its title: a thumbnail, a text snippet, or
an embed, depending on the file type.
_Avoid_: thumbnail, snippet, excerpt (each of these names only one kind of preview)

**Snippet term**:
The free-text word highlighted inside a result's content preview, so the user sees why the file
matched.
_Avoid_: highlight, match term

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
