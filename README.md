# Update Bun Dependencies Action

A GitHub Action that updates Bun project dependencies with proper latest version resolution.

## Why?

`bun update --latest` has a [known bug](https://github.com/oven-sh/bun/issues/21343): it writes the literal string `"latest"` into `package.json` instead of the resolved version number. This action fixes that by:

1. Querying the npm registry to resolve actual latest versions
2. Passing `pkg@version` arguments to `bun install` so concrete versions get written

## Usage

### Update to latest versions

```yaml
- uses: your-org/update-bun-dependencies-action@v1
  with:
    latest: 'true'
```

### Standard install (no latest)

```yaml
- uses: your-org/update-bun-dependencies-action@v1
```

### Full example with PR creation

```yaml
name: Update Dependencies
on:
  schedule:
    - cron: '0 6 * * 1' # weekly on Monday
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2

      - uses: your-org/update-bun-dependencies-action@v1
        id: update
        with:
          latest: 'true'

      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v7
        with:
          title: 'chore: update dependencies'
          body: |
            Updated packages:
            ```json
            ${{ steps.update.outputs.updated-packages }}
            ```
          branch: deps/update
          commit-message: 'chore: update dependencies'
```

## Inputs

| Input | Default | Description |
|---|---|---|
| `working-directory` | `.` | Working directory containing `package.json` |
| `latest` | `false` | Resolve and install absolute latest versions (ignoring semver ranges) |
| `registry-url` | `https://registry.npmjs.org` | npm registry URL |
| `token` | `""` | Bearer token for private registries |

## Outputs

| Output | Description |
|---|---|
| `updated-packages` | JSON map: `{ "pkg-name": { "from": "1.0.0", "to": "2.0.0" } }` |

## How it works

1. Reads `package.json` to collect all dependencies
2. Queries the npm registry (`GET <registry>/<package>`) for each dependency
3. Reads `dist-tags.latest` from the registry response
4. Compares with current resolved version
5. Spawns `bun install pkg1@ver1 pkg2@ver2 ...` with concrete versions
6. `bun install` handles updating `package.json`, `bun.lock`, and `node_modules`

Non-npm dependencies (`workspace:`, `file:`, `git:`, `github:`, `npm:` aliases, etc.) are skipped automatically.
