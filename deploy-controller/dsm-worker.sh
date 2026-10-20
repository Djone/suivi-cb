#!/bin/sh
# Fixed root task for DSM. Never downloads or executes code from a request.
set -eu
PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
export PATH
umask 077
CONTROL=/volume1/docker/suivi-cb-deployment-control
QUEUE=/volume1/docker/suivi-cb-release-queue
NODE_IMAGE=node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
[ "$(id -u)" = 0 ] && [ "$#" = 0 ] || exit 1
for P in "$CONTROL" "$CONTROL/code" "$QUEUE" "$QUEUE/outbox"; do
  [ -d "$P" ] && [ ! -L "$P" ] && [ "$(readlink -f "$P")" = "$P" ] && [ "$(stat -c %u "$P")" = 0 ] || exit 1
  mode=$(stat -c %a "$P")
  [ "$((0$mode & 022))" -eq 0 ] || exit 1
done
[ -d "$QUEUE/inbox" ] && [ ! -L "$QUEUE/inbox" ] && [ "$(readlink -f "$QUEUE/inbox")" = "$QUEUE/inbox" ] && [ "$(stat -c %u:%a "$QUEUE/inbox")" = 1028:700 ] || exit 1
[ "$(stat -c %a "$CONTROL")" = 700 ] || exit 1
[ -f "$QUEUE/inbox/request.json" ] || exit 0
mkdir "$CONTROL/.dsm-worker-lock" 2>/dev/null || exit 0
validated=
snapshot=
trap 'if [ -n "$validated" ]; then rm -f "$validated"; fi; if [ -n "$snapshot" ]; then rm -f "$snapshot"; fi; rmdir "$CONTROL/.dsm-worker-lock"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP
validated=$(mktemp "$CONTROL/.dsm-request.XXXXXX")
snapshot=$(mktemp "$CONTROL/.dsm-input.XXXXXX")
[ -f "$QUEUE/inbox/request.json" ] && [ ! -L "$QUEUE/inbox/request.json" ] || exit 1
cp -P "$QUEUE/inbox/request.json" "$snapshot"
[ -f "$snapshot" ] && [ ! -L "$snapshot" ] && [ "$(stat -c %s "$snapshot")" -le 8192 ] || exit 1
chown 0:0 "$snapshot"; chmod 600 "$snapshot"
# The request directory is read-only in a container, never interpreted by the host shell.
if ! docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --memory 96m --pids-limit 64 \
  --mount "type=bind,source=$snapshot,target=/requests/request.json,readonly" \
  --mount "type=bind,source=$CONTROL,target=/control,readonly" \
  --entrypoint node "$NODE_IMAGE" /control/code/deploy-controller/dsm-request.cjs > "$validated"; then
  echo DSM_REQUEST_REJECTED >&2
  # Do not execute or delete an invalid request; operator inspection is required.
  exit 1
fi
{
  IFS= read -r nonce
  IFS= read -r action
  IFS= read -r identity
  IFS= read -r candidate
  IFS= read -r commit
  IFS= read -r manifest_sha
  IFS= read -r archive_sha
} < "$validated"
# Check again on the host before using any value in a filename or command argument.
printf '%s\n' "$nonce" | grep -Eq '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' || exit 1
for value in "$identity" "$manifest_sha" "$archive_sha"; do printf '%s\n' "$value" | grep -Eq '^[a-f0-9]{64}$' || exit 1; done
printf '%s\n' "$commit" | grep -Eq '^[a-f0-9]{40}$' || exit 1
printf '%s\n' "$candidate" | grep -Eq '^2\.2\.0-rc\.[1-9][0-9]*$' || exit 1
[ ! -e "$QUEUE/outbox/$nonce.json" ] && [ ! -L "$QUEUE/outbox/$nonce.json" ] || { echo DSM_REQUEST_REPLAY_REFUSED >&2; exit 1; }
configuration_sha=$(sha256sum "$CONTROL/.env.preprod" "$CONTROL/approval.json" "$CONTROL/code/deploy-controller/nas-preproduction.sh" "$CONTROL/code/deploy-controller/validate-bundle.cjs" "$CONTROL/code/scripts/ci/contracts.cjs" "$CONTROL/code/scripts/ci/common.cjs" | sha256sum | cut -d ' ' -f1)
# A started request is never retried automatically, even if DSM/host crashes before its receipt.
ln "$validated" "$CONTROL/.dsm-started-$nonce" 2>/dev/null || { echo DSM_EXECUTION_ALREADY_STARTED >&2; exit 1; }
PLAN_FILE=$CONTROL/.dsm-plan-$manifest_sha
status=FAILED
case "$action" in
  plan)
    if sh "$CONTROL/code/deploy-controller/nas-preproduction.sh" plan "$manifest_sha"; then
      [ ! -L "$PLAN_FILE" ] || exit 1
      printf '%s\n' "$identity:$configuration_sha" > "$PLAN_FILE"
      chown 0:0 "$PLAN_FILE"; chmod 600 "$PLAN_FILE"
      status=PLAN_PASS
    fi ;;
  apply-preproduction)
    FLAG=$CONTROL/ENABLE_DSM_PREPRODUCTION
    if [ ! -f "$PLAN_FILE" ] || [ -L "$PLAN_FILE" ] || [ "$(stat -c %u:%a "$PLAN_FILE")" != 0:600 ] || [ "$(cat "$PLAN_FILE")" != "$identity:$configuration_sha" ]; then
      status=PLAN_REQUIRED
    elif [ -f "$FLAG" ] && [ ! -L "$FLAG" ] && [ "$(stat -c %u:%a "$FLAG")" = 0:600 ]; then
      # Existing controller also requires its own root-owned apply enable file.
      if sh "$CONTROL/code/deploy-controller/nas-preproduction.sh" apply "$manifest_sha"; then status=PREPRODUCTION_SMOKE_PASS; fi
    else status=APPLY_DISABLED; fi ;;
  *) exit 1 ;;
esac
receipt=$(mktemp "$QUEUE/outbox/.receipt.XXXXXX")
printf '{"schema":1,"nonce":"%s","identity":"%s","candidate":"%s","commit":"%s","action":"%s","archiveSha256":"%s","status":"%s","productionApproved":false,"databaseRestored":false}\n' "$nonce" "$identity" "$candidate" "$commit" "$action" "$archive_sha" "$status" > "$receipt"
chmod 644 "$receipt"
# Hard link publishes without overwriting a receipt, including after a crash.
ln "$receipt" "$QUEUE/outbox/$nonce.json"
rm "$receipt"
rm "$QUEUE/inbox/request.json"
printf 'DSM_REQUEST_FINISHED %s %s\n' "$nonce" "$status"
[ "$status" = PLAN_PASS ] || [ "$status" = PREPRODUCTION_SMOKE_PASS ]
