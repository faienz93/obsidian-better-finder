# Commit rules

Git only. Everything else is in [behaviour.md](./behaviour.md).

- **Ask before committing.** Propose the commit — what goes in it and the message you intend to
  write — and wait for a yes. Never commit on your own initiative, not even when the work is
  obviously finished.

- **Never write `Co-Authored-By: Claude ...`** in a commit message, nor any other attribution
  trailer naming the assistant.

- **Write commits in the user's own style**: short imperative subject with a `type:` prefix
  (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), and a body that explains *why*
  when the subject isn't self-evident.

- **One commit, one concern.** Don't mix a refactor with the feature that motivated it, or
  documentation with code, unless they genuinely cannot stand apart.

- **Never push unless asked**, and never rewrite history that has already been pushed.
