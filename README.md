# Update Bun Dependencies Action

A GitHub Action that updates Bun project dependencies with proper latest version resolution. Optionally creates a pull request with the changes.

## Why?

`bun update --latest` has a [known bug](https://github.com/oven-sh/bun/issues/21343): it writes the literal string `"latest"` into `package.json` instead of the resolved version number. This action fixes that by:

1. Querying the npm registry to resolve actual latest versions
2. Passing `pkg@version` arguments to `bun install` so concrete versions get written

## Usage

### Update and create a PR (all-in-one)

```yaml
- uses: your-org/update-bun-dependencies-action@v1
  with:
    latest: 'true'
    create-pr: 'true'
```

This resolves latest versions, runs `bun install`, commits the changes, and opens a pull request — no separate action needed.

### Update only (no PR)

```yaml
- uses: your-org/update-bun-dependencies-action@v1
  with:
    latest: 'true'
```

### Standard install (no latest resolution)

```yaml
- uses: your-org/update-bun-dependencies-action@v1
```

### Full example: scheduled weekly updates

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

      - uses: your-org/update-bun-dependencies-action@v1
        with:
          latest: 'true'
          create-pr: 'true'
          pr-branch: 'deps/update'
          pr-title: 'chore: update dependencies'
          pr-commit-message: 'chore: update dependencies'
          pr-labels: 'dependencies,automated'
```

## Inputs

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
7. If `create-pr` is enabled: creates a branch, commits, pushes, and opens a PR via Octokit

Non-npm dependencies (`workspace:`, `file:`, `git:`, `github:`, `npm:` aliases, etc.) are skipped automatically.

## Permissions

When using `create-pr: true`, the workflow needs:

```yaml
permissions:
  contents: write       # push the branch
  pull-requests: write  # create the PR
```
