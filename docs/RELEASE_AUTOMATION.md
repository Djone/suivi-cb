# Release Automation

## Mandatory preproduction gate

The required flow is **development → validated development tests →
preproduction → validated preproduction tests → Git publication → production
promotion**. The release UI automates local tests and Git/version operations.
Candidate construction, export and verified NAS transfer are automated by
`npm.cmd run release:candidate -- --candidate=2.2.0-rc.3 --execute` in Windows PowerShell
(use `npm` on Linux/macOS).
See [candidate automation](./AUTOMATISATION_CANDIDATE.md) for simulation, transfer
retry and explicit image-bound operator approval. Preproduction installation,
validation and production promotion still require NAS operations.

Record the candidate commit, validation date and exact running backend/frontend
image IDs. Promote those same images with production configuration and data;
do not rebuild from development or on production. Follow
[PROMOTION_PREPROD_PRODUCTION.md](./PROMOTION_PREPROD_PRODUCTION.md).

The release UI requires an operator acknowledgment before `deploy`, but does
not query the NAS or verify this evidence. `deploy` only merges/pushes Git and
creates the tag; it does not deploy Docker images. Do not use `release:full`
for this flow, because it does not pause for preproduction validation.

The [release assistant guide](../frontend/src/app/components/release-process/README.md)
describes the complete operator workflow. The CLI validates the source and
tests before Git publication; it does not enforce or perform NAS validation.

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
  - Creates the preparation commit when `--commit` is supplied; it does not
    push the candidate branch. Push the prepared candidate before building it
    for preproduction.

- `npm run release:deploy -- --branch=master`

  - Runs preflight + tests.
  - With `--execute`, merges the current release branch into `master`, pushes
    `master`, then creates and pushes the stable tag (for example `v2.0.0`).
  - Run only after the matching candidate has passed preproduction validation.
  - Add `--create-next-branch` to create and publish the next development
    branch automatically after the merge, based on the version in `package.json`
    (for example `2.1.0`). The option is idempotent when the branch already exists.
  - Pushing a stable tag triggers `.github/workflows/publish-github-release.yml`.
  - A major tag ending in `.0.0` (for example `v2.0.0`) creates the corresponding
    major GitHub Release (`v2`) and marks it as latest.
  - Later minor and patch tags (for example `v2.1.0` and `v2.0.1`) keep their
    immutable exact tags, move the major alias `v2` to the latest deployed commit,
    and append their generated notes to the existing `v2` release.

- `npm run release:full -- --stable=1.3.0 --next=1.4.0-dev --branch=master`

  - Executes prepare + deploy flow in one command. Do not use for a release
    that must stop for preproduction validation.

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

- Executed deployment requires a clean working tree and no merge in progress,
  including when `--allow-dirty` was supplied.
- If the deployment merge conflicts, the orchestrator aborts that merge before
  returning to the source release branch. The report records whether recovery
  succeeded in `git-restore-source`; it does not select an older version backup.
- Returning to the source branch preserves the prepared versions: for example,
  production `2.0.0` and development `2.1.0-dev` after preparing that release.
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
