# Coding standards

Judgement calls a reviewer applies to every diff. Mechanical rules live in `.eslintrc` and the compiler; how to write comments and when to rename are in `.claude/rules/behaviour.md`, which the review applies too.

## Components draw, the engine decides

UI components only render. What a result shows, which lines of a note to draw, how occurrences merge: that logic lives in `src/engine/` (`ResultData`, `occurrences`) or in `Finder`, as pure functions a test can reach. A component that parses file content, filters what to show or deduplicates is a finding, even when it works.

## One answer per question

Each question about a file has one function that answers it, and every caller asks that function:

| Question | Answer |
|---|---|
| Does this file get a Preview? | `ImagePreview.hasPreview` |
| What are this file's tags? | `getFileTags` |
| Does this tag match the query tag? | `matchesTag` |
| Is this task done? | `isDoneTask` |
| Is this `.md` an Excalidraw drawing? | `isExcalidraw` |

A filter exports the predicate it owns (`isDoneTask` from `TaskFilter.ts`, `matchesTag` from `TagsFilter.ts`) and other modules import it from there. A copy of the check inline, or a list of extensions kept by a caller, is a finding.

When a file type is added, the Preview and the search indexing change in the same diff.

## Domain language

New identifiers, comments, test names and CSS classes use the terms of `CONTEXT.md`: an **Item**, not a row; **Occurrences**, not a snippet; the **Moodboard**, not a sidebar. A new name built on a word listed under _Avoid_ is a finding. Existing names stay until a rename is approved, so flag only names the diff introduces.

## Results

The number of results shown is never capped unless the issue asks for it. Long lists load lazily through an `IntersectionObserver`, not through pagination, and a note's content is read only when its Item or Card becomes visible.
