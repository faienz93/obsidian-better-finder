---
name: release
description: Cut a release or a hotfix of the plugin with a manual git flow — branch, bump, merge into master and develop, tag, build and create a draft GitHub release with the three Obsidian assets.
disable-model-invocation: true
argument-hint: '[hotfix] patch | minor | major | x.y.z'
---

Arguments: `$ARGUMENTS`.

- No `hotfix` word → **release** from `develop`. The bump defaults to `minor`.
- `hotfix` as the first word → **hotfix** from `master`. The bump defaults to `patch`.
- The bump is `patch`, `minor`, `major` or an exact `x.y.z`.

Obsidian downloads `main.js`, `manifest.json` and `styles.css` from the GitHub release whose
**tag equals `manifest.json` `version` exactly**: `x.y.z`, no `v` prefix. Every step below keeps
that invariant.

The flow is git flow done by hand with plain `git` commands. Do not use `git flow …`.

| Branch            | Comes from | Goes back into                                           |
| ----------------- | ---------- | -------------------------------------------------------- |
| `feature/*`       | `develop`  | `develop`                                                |
| `release/<x.y.z>` | `develop`  | `master` (tagged) and `develop`                          |
| `hotfix/<x.y.z>`  | `master`   | `master` (tagged) and `develop`, or the open `release/*` |

This skill checks out branches in the main working tree, which is the one exception to "inspect
other commits with `git worktree`". With `npm run dev` in watch, Obsidian reloads the plugin at
each checkout; tell the user before the first one.

## 1. Preconditions — stop and report if any fails

```bash
git status --porcelain              # must be empty
git fetch origin --prune
git rev-list --left-right --count master...origin/master    # must be 0 0
git rev-list --left-right --count develop...origin/develop  # must be 0 0
git branch -a --list '*release/*' '*hotfix/*'               # see below
```

- For a release: no `release/*` branch may exist, locally or on `origin`.
- For a hotfix: no other `hotfix/*` branch may exist. An open `release/*` is allowed; remember
  it for step 5.
- `manifest.json` must not still carry the sample template's `description`, `authorUrl` or
  `fundingUrl`. If it does, stop and ask the user for the real values.

## 2. Compute the version and open the branch

Current version: `node -p "require('./package.json').version"`. Apply the bump to it
(`1.2.3` + `minor` → `1.3.0`, + `patch` → `1.2.4`, + `major` → `2.0.0`) or take the exact
`x.y.z`. The new version must be greater than the current one, and `git tag --list <version>` must
be empty. Tell the user the version before going on.

First release: when no tag exists yet, an exact `x.y.z` equal to the current version is allowed.
Step 3 then adds `--allow-same-version`, and step 4 is skipped if nothing changed.

Release:

```bash
git checkout develop
git checkout -b release/<version>
```

Hotfix:

```bash
git checkout master
git checkout -b hotfix/<version>
```

For a hotfix, the fix itself goes on this branch now, as its own `fix:` commit(s), following
`.claude/rules/commit.md`. Ask the user what the fix is if it was not given.

## 3. Bump and verify

```bash
npm version <version> --no-git-tag-version
```

`--no-git-tag-version` stops npm from committing and from creating a `v`-prefixed tag. The
`version` script still runs `version-bump.mjs`, which writes `manifest.json` and `versions.json`.

Then run `npm run build`, `npm test` and `npm run lint` on this branch; all three must pass.

The release or hotfix branch is the release environment: everything that prepares this version
happens here, never on `develop` or a `feature/*` branch. That covers the manual check in Obsidian
(Modal and Moodboard, see `CLAUDE.md`), the fixes it turns up, code cleanups such as a simplify
pass, and `manifest.json` or docs touch-ups. Each is its own commit on this branch, per
`.claude/rules/commit.md`. New features never go here: they wait for the next release.

Show the user the diff of `package.json`, `package-lock.json`, `manifest.json`, `versions.json`.

## 4. Commit the bump — ask first

Per `.claude/rules/commit.md`, propose and wait for a yes:

```bash
git add package.json package-lock.json manifest.json versions.json
git diff --cached --stat
git commit -m "chore: release <version>"
```

## 5. Merge and tag — ask first

Show the user the merges and the tag below and wait for a yes. `<branch>` is `release/<version>`
or `hotfix/<version>`.

```bash
git checkout master
git merge --no-ff <branch> -m "Merge branch '<branch>'"
git tag -a <version> -m <version>

git checkout develop        # hotfix with an open release/*: check out that branch instead
git merge --no-ff <branch> -m "Merge branch '<branch>' into develop"

git branch -d <branch>
```

If the merge back into `develop` (or `release/*`) conflicts, stop and show the conflicts. The usual
ones are `manifest.json`, `versions.json` and `package.json`; keep the higher version.

## 6. Build the assets from the tagged commit

```bash
git checkout <version>
npm run build
ASSETS="$(mktemp -d)/<version>"
mkdir -p "$ASSETS"
cp main.js manifest.json styles.css "$ASSETS/"
ls -l "$ASSETS"
git checkout develop
```

`main.js` is gitignored, so it must come from this build, not from the repo. The copy matters:
once `develop` is checked out, `npm run dev` in watch rebuilds `main.js` from `develop`, so
step 7 uploads from `$ASSETS`, never from the working tree.

## 7. Push and draft release — ask first

Pushing and publishing are outward-facing. Ask before the push and again before the release:

```bash
git push origin master develop <version>
git push origin --delete <branch>   # only if the branch was pushed
```

```bash
gh release create <version> --draft --title <version> --generate-notes "$ASSETS/main.js" "$ASSETS/manifest.json" "$ASSETS/styles.css"
```

The release is a **draft**: give the user the URL and let them publish it.
