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
  - Build/deploy steps are dry-run unless `--execute` is provided.
  - Build can be skipped with `--skip-build`.
  - NAS deploy is optional via `--with-nas-deploy` (Linux/Mac script only).

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
- `--with-nas-deploy`
- `--rollback-on-failure`
- `--report=data/release/custom-report.json`
