#!/bin/sh
# Runs only inside a disposable container: no host Docker socket or production mount.
set -eu
CONTROL=/volume1/docker/suivi-cb-deployment-control
QUEUE=/volume1/docker/suivi-cb-release-queue
mkdir -p /volume1/docker
adduser -D -H -u 1028 GodOfNasAugerie
cp /smoke/initial-entry.sh /usr/local/bin/suivi-cb-key-entry
chmod 755 /usr/local/bin/suivi-cb-key-entry
sh /kit/install-dsm-executor.sh
[ ! -e "$CONTROL/ENABLE_DSM_PREPRODUCTION" ]
[ ! -e "$CONTROL/ENABLE_PREPRODUCTION_APPLY" ]
mkdir -m 700 "$CONTROL/incoming"
cp /smoke/manifest.json "$CONTROL/incoming/manifest.json"
cp /smoke/approval.json "$CONTROL/approval.json"
printf 'KEYCLOAK_REALM=suivi-cb-preprod\n' > "$CONTROL/.env.preprod"
chmod 600 "$CONTROL/approval.json" "$CONTROL/.env.preprod"
mkdir /control /requests
cp -R "$CONTROL/code" /control/code
cp "$CONTROL/approval.json" /control/approval.json
mkdir /control/incoming
cp "$CONTROL/incoming/manifest.json" /control/incoming/manifest.json
# Docker stand-in runs the real validator; the outer container has no Docker socket.
cat > /usr/local/bin/docker <<'DOCKER'
#!/bin/sh
set -eu
snapshot=
for arg in "$@"; do
  case "$arg" in type=bind,source=*,target=/requests/request.json,readonly) snapshot=${arg#type=bind,source=}; snapshot=${snapshot%,target=/requests/request.json,readonly};; esac
done
[ -n "$snapshot" ]
cp "$snapshot" /requests/request.json
node /control/code/deploy-controller/dsm-request.cjs
if [ -f /race ]; then printf '\n' >> /volume1/docker/suivi-cb-deployment-control/incoming/manifest.json; fi
DOCKER
chmod 755 /usr/local/bin/docker
cp "$CONTROL/code/deploy-controller/nas-preproduction.sh" /original-controller.sh
cat > "$CONTROL/code/deploy-controller/nas-preproduction.sh" <<'CONTROLLER'
#!/bin/sh
set -eu
[ "$1" = plan ] || { touch /unexpected-apply; exit 1; }
[ "$2" = "$(sha256sum /volume1/docker/suivi-cb-deployment-control/incoming/manifest.json | cut -d ' ' -f1)" ]
echo PLAN_ONLY
CONTROLLER
chmod 600 "$CONTROL/code/deploy-controller/nas-preproduction.sh"
worker() { sh "$CONTROL/code/deploy-controller/dsm-worker.sh"; }
request() {
  ACTION=$1 NONCE=$2 VARIANT=${3:-valid} node /smoke/request.cjs | su -s /bin/sh GodOfNasAugerie -c 'SSH_ORIGINAL_COMMAND=suivi-cb-queue /usr/local/bin/suivi-cb-key-entry'
}
worker
request plan 11111111-1111-4111-8111-111111111111
worker
grep -q '"status":"PLAN_PASS"' "$QUEUE/outbox/11111111-1111-4111-8111-111111111111.json"
echo DSM_PLAN_PASS
if su -s /bin/sh GodOfNasAugerie -c 'SSH_ORIGINAL_COMMAND=id /usr/local/bin/suivi-cb-key-entry'; then exit 1; fi
if su -s /bin/sh GodOfNasAugerie -c 'SSH_ORIGINAL_COMMAND="suivi-cb-receipt ../../etc/passwd" /usr/local/bin/suivi-cb-key-entry'; then exit 1; fi
su -s /bin/sh GodOfNasAugerie -c 'SSH_ORIGINAL_COMMAND="suivi-cb-receipt 11111111-1111-4111-8111-111111111111" /usr/local/bin/suivi-cb-key-entry' | grep -q PLAN_PASS
echo DSM_KEY_COMMANDS_RESTRICTED
request plan 11111111-1111-4111-8111-111111111111
if worker; then exit 1; fi
rm "$QUEUE/inbox/request.json"
echo DSM_REPLAY_REFUSED
request apply-preproduction 22222222-2222-4222-8222-222222222222
if worker; then exit 1; fi
grep -q '"status":"APPLY_DISABLED"' "$QUEUE/outbox/22222222-2222-4222-8222-222222222222.json"
[ ! -e /unexpected-apply ]
echo DSM_APPLY_DISABLED
printf started > "$CONTROL/.dsm-started-55555555-5555-4555-8555-555555555555"
request plan 55555555-5555-4555-8555-555555555555
if worker; then exit 1; fi
[ -f "$QUEUE/inbox/request.json" ]
[ ! -e "$QUEUE/outbox/55555555-5555-4555-8555-555555555555.json" ]
rm "$QUEUE/inbox/request.json"
echo DSM_INTERRUPTED_REQUEST_NOT_RETRIED
for variant in foreign expired production; do
  request plan 33333333-3333-4333-8333-333333333333 "$variant"
  if worker; then exit 1; fi
  [ -f "$QUEUE/inbox/request.json" ]
  rm "$QUEUE/inbox/request.json"
done
echo DSM_INVALID_REQUESTS_REFUSED
cp /original-controller.sh "$CONTROL/code/deploy-controller/nas-preproduction.sh"
touch /race
request plan 44444444-4444-4444-8444-444444444444
if worker; then exit 1; fi
grep -q '"status":"FAILED"' "$QUEUE/outbox/44444444-4444-4444-8444-444444444444.json"
[ ! -e "$CONTROL/.deployment-lock" ]
[ ! -e "$CONTROL/.dsm-worker-lock" ]
echo DSM_MANIFEST_RACE_REFUSED
echo DSM_ISOLATED_SMOKE_OK
