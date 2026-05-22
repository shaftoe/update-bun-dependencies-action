# Update Bun Dependencies Action

A GitHub Action that updates Bun project dependencies with proper latest version resolution. Optionally creates a pull request with the changes.

## Why?

`bun update --latest` has a [known bug](https://github.com/oven-sh/bun/issues/21343): it writes the literal string `"latest"` into `package.json` instead of the resolved version number. This action fixes that by:

1. Querying the npm registry to resolve actual latest versions
2. Passing `pkg@version` arguments to `bun install` so concrete versions get written

## Quick Start — Reusable Workflow (recommended)

The easiest way to use this action is via the **reusable workflow**. Add this to any repo:

```yaml
# .github/workflows/daily-deps-update.yml
name: Daily Dependency Update
on:
  schedule:
    - cron: '0 6 * * *' # every day at 06:00 UTC
  workflow_dispatch:

jobs:
  update-deps:
    uses: shaftoe/update-bun-dependencies-action/.github/workflows/update-bun-dependencies.yml@v1
    with:
      post-update-run: 'bun test'
```

That's it — no `permissions`, no `checkout`, no `setup-bun`. The reusable workflow handles everything. It checks out your repo, installs Bun, resolves updates, and opens (or **updates**) a PR.

### Reusable workflow inputs

| Input | Default | Description |
|---|---|---|
| `working-directory` | `.` | Working directory containing `package.json` |
| `latest` | `true` | Resolve absolute latest versions |
| `registry-url` | `https://registry.npmjs.org` | npm registry URL |
| `create-pr` | `true` | Create a pull request with the changes |
| `pr-branch` | `deps/update` | Branch name for the PR |
| `pr-title` | `chore(deps): update dependencies` | PR title |
| `pr-commit-message` | `chore(deps): update dependencies` | Commit message |
| `pr-labels` | `dependencies,automated` | Comma-separated labels |
| `pr-update-strategy` | `update` | `"update"` reuse existing PR or `"create"` unique branch per run |
| `post-update-run` | `""` | Command to run after updating deps (e.g. `bun test`) |
| `bun-version` | `latest` | Bun version to install |

## Using the Action Directly

You can also call the action directly in your own workflow:

```yaml
name: Update Dependencies
on:
  schedule:
    - cron: '0 6 * * 1' # weekly on Monday
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - uses: shaftoe/update-bun-dependencies-action@v1
        with:
          latest: 'true'
          create-pr: 'true'
          pr-branch: 'deps/update'
          pr-title: 'chore: update dependencies'
          pr-commit-message: 'chore: update dependencies'
          pr-labels: 'dependencies,automated'
          post-update-run: 'bun test'
```

## PR Update Behavior

By default (`pr-update-strategy: update`), the action **reuses the same branch and PR** on repeated runs:

1. First run → creates branch `deps/update` and opens a PR
2. Subsequent runs → force-pushes new commit to `deps/update`, updates the PR title/body

This means daily scheduled runs produce **one PR** that keeps getting updated, instead of creating a new PR each time.

Set `pr-update-strategy: create` to get the legacy behavior (unique branch per run).

## Action Inputs

| Input | Default | Description |
|---|---|---|
| `working-directory` | `.` | Working directory containing `package.json` |
| `latest` | `false` | Resolve and install absolute latest versions (ignoring semver ranges) |
| `registry-url` | `https://registry.npmjs.org` | npm registry URL |
| `token` | `""` | Bearer token for private registries |
| `create-pr` | `false` | Create a pull request with the updated files (uses `GITHUB_TOKEN`) |
| `pr-branch` | `deps/update` | Branch name for the pull request |
| `pr-title` | `chore: update dependencies` | Title for the pull request |
| `pr-commit-message` | `chore: update dependencies` | Commit message for the update |
| `pr-labels` | `""` | Comma-separated list of labels to add to the PR |
| `pr-update-strategy` | `update` | `"update"` reuse existing PR/branch, `"create"` unique branch per run |
| `post-update-run` | `""` | Command to run after dependencies are updated but before the PR is created |

## Outputs

| Output | Description |
|---|---|
| `updated-packages` | JSON map: `{ "pkg-name": { "from": "1.0.0", "to": "2.0.0" } }` |
| `pr-url` | URL of the created pull request (empty if `create-pr` is `false`) |

## How it works

1. Reads `package.json` to collect all dependencies
2. Queries the npm registry (`GET <registry>/<package>`) for each dependency
3. Reads `dist-tags.latest` from the registry response
4. Compares with current resolved version
5. Spawns `bun install pkg1@ver1 pkg2@ver2 ...` with concrete versions
6. `bun install` handles updating `package.json`, `bun.lock`, and `node_modules`
7. If `create-pr` is enabled: creates a branch, commits, pushes, and opens (or updates) a PR via Octokit

Non-npm dependencies (`workspace:`, `file:`, `git:`, `github:`, `npm:` aliases, etc.) are skipped automatically.

## Permissions

When using `create-pr: true`, the workflow needs:

```yaml
permissions:
  contents: write       # push the branch
  pull-requests: write  # create the PR
```
