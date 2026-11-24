# Modal and Moodboard share every interaction with the Query

The Modal and the Moodboard are two ways of looking at the same search, not two products. Every
interaction that changes the Query (a Filter chip, a Value chip, the clear button, and whatever
comes next) behaves the same in both and has one implementation, which both views call. A view may
differ only in how it draws results (a List of Items, or a grid of Cards) and in its lifecycle (the
Modal closes when a result opens; the Moodboard stays open). A feature that changes the Query lands
in both views at once, or in neither.

The alternative was to let each view grow its own UX. We rejected it: a user who moves from the
Modal to the Moodboard should not have to relearn what a click does, and two implementations of
the same interaction would need every fix twice and would drift apart.

## Consequences

- One known exception: ↑/↓ walk the search history only in the Moodboard. In the Modal they move
  the selection between results, an Obsidian `SuggestModal` behaviour we keep. A history both views
  can reach is tracked in #14; once it lands, this exception can go.
