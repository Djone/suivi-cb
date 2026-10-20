# Controlled NAS preproduction and DSM executor

Manual GitHub self-approval has been authorized for Djone. Publishing and production still require their qualified delivery path. The DSM kit installs reviewed, restricted preproduction code only; it does not install a GitHub runner, retrieve GitHub requests or operate production.
The private repository Djone/suivi-cb-deploy exists with Actions disabled.

## Trust boundary

Only reviewed, installed code may execute. A root operator must install this
repository's deploy-controller directory and scripts/ci/{common,contracts}.cjs
under /volume1/docker/suivi-cb-deployment-control/code, with all parents and code
owned by root and inaccessible for modification by transfer/application users.
The controller, code and incoming directories must have mode 700. Incoming
artifacts are data only: downloaded scripts are never executed.

Before staging an artifact, verify its GitHub run, source commit, successful
Required CI, artifact SHA-256 and candidate manifest. This provenance check is
currently manual; automatic authenticated retrieval is still to implement.
Local checksums alone do not establish GitHub provenance.

Stage the complete qualified archive contents in incoming. Place approval.json
and .env.preprod at the control root, root-owned mode 600, without symlinks.
The environment accepts only KEYCLOAK_URL=https://auth.jolurie.com,
KEYCLOAK_REALM=suivi-cb-preprod, KEYCLOAK_CLIENT_ID=suivi-cb-web,
KEYCLOAK_AUDIENCE=suivi-cb-api and optional DOCUMENTATION_DISABLED=true.
No production environment file or real database may be supplied.

Approval fields: target=preproduction, approved=true, approvedBy=operator GitHub
login, approvedAt=ISO timestamp, candidate, commit, archiveSha256 and runId.
The last four fields must match the qualified manifest exactly. This local
operator record is not a GitHub environment approval and cannot unlock GHCR.

## Execution contract

nas-preproduction.sh defaults to plan. It validates the whole inventory,
checksums, qualification, quality/source identity, test and scan proofs in a
pinned Node utility container with no network, no Docker socket and read-only
mounts. The default mode changes no application service.

Apply additionally requires an explicitly installed root-owned mode-600
ENABLE_PREPRODUCTION_APPLY file and at least 512 MiB available memory.
Do not create this file until final NAS acceptance is authorized. No NAS task,
secret or enable file is installed by this repository.

Apply loads the same TAR images, checks configuration identity, revision,
architecture and non-root users, then starts only suivi-cb-ci-preprod services
at 127.0.0.1:4205. Data is a fresh synthetic database under the fixed separate
/volume1/docker/suivi-cb-ci-preprod/data directory. Existing resources must
carry the expected ownership label. Never redirect the production proxy to
this port as part of these tests.

Before upgrading an existing isolated backend, VACUUM INTO creates a coherent
SQLite snapshot and verifies integrity and SHA-256. An existing snapshot is
never overwritten. The source database is never restored or replaced.
Health, frontend 200 and anonymous API 401 are smoke checks only. A receipt
explicitly leaves human acceptance and production approval pending. Failure
preserves the current database; no automatic rollback is claimed. A signal
aborts the task. After interruption, inspect actual containers and database
before any retry; absence of a receipt is not success.

## Remaining validation

Local tests cover environment/approval rejection and online SQLite consistency
including subsequent writes. Shell syntax is checked separately. Installation,
permissions, Compose compatibility, actual Docker import, memory and recovery
must still be exercised on the NAS at final acceptance. The production engine,
automatic approved-request retrieval and a complete isolated promotion/rollback
exercise remain outstanding. Keep the verified TAR/SSH fallback.


DSM installation and validation: docs/EXECUTEUR_DSM_2_2_0.md. The installer leaves application disabled. Requests and technical receipts are bound to the exact candidate and archived by the local release page. Production and registry publication are outside this executor.
