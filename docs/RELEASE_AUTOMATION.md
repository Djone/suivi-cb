# Release Automation

This project provides a release orchestration CLI with validation before production.

## Commands

- `npm run release:dry-run -- --branch=master`

  - Runs git preflight checks and tests.
  - Does not change files.

- `npm run release:prepare -- --stable=1.3.0 --next=1.4.0-dev --branch=master`

  - Runs preflight + tests.
  - Updates version files:
    - `package.json` (next dev version)
    - `frontend/src/environments/environment.ts` (next dev version)
    - `frontend/src/environments/environment.prod.ts` (stable version)
    - regenerates `frontend/src/app/version.ts`

- `npm run release:deploy -- --branch=master`

  - Runs preflight + tests.
  - With `--execute`, merges the current release branch into `master`, pushes
    `master`, then creates and pushes the stable tag (for example `v2.0.0`).
  - Pushing a stable tag triggers `.github/workflows/publish-github-release.yml`.
  - A major tag ending in `.0.0` (for example `v2.0.0`) creates the corresponding
    major GitHub Release (`v2`) and marks it as latest.
  - Later minor and patch tags (for example `v2.1.0` and `v2.0.1`) keep their
    immutable exact tags, move the major alias `v2` to the latest deployed commit,
    and append their generated notes to the existing `v2` release.

- `npm run release:full -- --stable=1.3.0 --next=1.4.0-dev --branch=master`

  - Executes prepare + deploy flow in one command.

- `npm run release:rollback`
  - Restores version files from the latest backup in `data/release/backups`.

## Optional Git steps

You can add Git steps to `prepare` or `full` only when useful:

- `--create-release-branch`
- `--release-branch=release/1.3.0` (optional explicit name)
- `--branch-prefix=release/` (used when no explicit branch name)
- `--commit`
- `--tag`

Example:

`npm run release:prepare -- --stable=1.3.0 --next=1.4.0-dev --create-release-branch --commit --tag`

## Rollback behavior

- Backups are created automatically before version updates during `prepare` and `full`.
- Backup location: `data/release/backups`.
- Auto rollback on failure can be enabled with `--rollback-on-failure`.
- Manual rollback is available via `release:rollback`.

## Validation and reports

Each run writes a report:

- `data/release/last-report.json`
- `data/release/report-YYYY-MM-DDTHH-MM-SS-sssZ.json`

## Useful flags

- `--skip-tests`
- `--skip-master-check`
- `--allow-dirty`
- `--execute`
- `--rollback-on-failure`
- `--report=data/release/custom-report.json`
