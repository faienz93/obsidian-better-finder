---
name: release
description: Cut a release of the plugin — bump the version, build, tag and create a draft GitHub release with the three Obsidian assets.
disable-model-invocation: true
argument-hint: patch | minor | major | x.y.z
---

Release the plugin at version bump `$ARGUMENTS` (default `patch`).

Obsidian downloads `main.js`, `manifest.json` and `styles.css` from the GitHub release whose
**tag equals `manifest.json` `version` exactly** — `x.y.z`, no `v` prefix. Every step below
exists to keep that invariant.

## 1. Preconditions — stop and report if any fails

- Current branch is `master` and the working tree is clean (`git status --porcelain` is empty).
- `master` is up to date with `origin/master`.
- `npm run build` passes (tsc + esbuild production).
- `npm test` passes.
- `npm run lint` passes.

## 2. Bump

```bash
npm version $ARGUMENTS --no-git-tag-version
```

`--no-git-tag-version` stops npm from committing and from creating a `v`-prefixed tag. The
`version` script still runs `version-bump.mjs`, which writes `manifest.json` and `versions.json`.

Show the user the diff of `package.json`, `package-lock.json`, `manifest.json`, `versions.json`.

## 3. Commit, tag — ask first

Per `.claude/rules/commit.md`, propose and wait for a yes:

- Commit: `chore: release <version>` with the four files above.
- Annotated tag: `git tag -a <version> -m <version>`.

## 4. Build the assets from the tagged commit

```bash
npm run build
ls -l main.js manifest.json styles.css
```

`main.js` is gitignored, so it must come from this build, not from the repo.

## 5. Push and draft release — ask first

Pushing and publishing are outward-facing. Ask before each:

```bash
git push origin master
git push origin <version>
gh release create <version> --draft --title <version> --generate-notes main.js manifest.json styles.css
```

The release is a **draft**: give the user the URL and let them publish it.
