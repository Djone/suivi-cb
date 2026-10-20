#!/bin/sh
set -eu
umask 077
[ "$(id -u)" = 0 ] || { echo 'Run with sudo.' >&2; exit 1; }
RELEASE=/volume1/docker/suivi-cb-preprod/releases/__CANDIDATE__
KIT=$RELEASE/nas-kit
SOURCE=$RELEASE/candidate-__RUN__
CONTROL=/volume1/docker/suivi-cb-deployment-control
[ "$(readlink -f "$KIT")" = "$KIT" ] && [ "$(readlink -f "$SOURCE")" = "$SOURCE" ] || exit 1
(cd "$KIT" && sha256sum -c SHA256SUMS)
(cd "$SOURCE" && sha256sum -c SHA256SUMS)
[ ! -L "$CONTROL" ] || exit 1
mkdir -p "$CONTROL"
[ "$(readlink -f "$CONTROL")" = "$CONTROL" ] || exit 1
chown 0:0 "$CONTROL"
if [ -x /usr/syno/bin/synoacltool ] && /usr/syno/bin/synoacltool -get "$CONTROL" >/dev/null 2>&1; then /usr/syno/bin/synoacltool -del "$CONTROL" >/dev/null; fi
chmod 700 "$CONTROL"
mkdir "$CONTROL/.deployment-lock" || { echo 'Another preparation/deployment is active.' >&2; exit 1; }
trap 'rmdir "$CONTROL/.deployment-lock"' EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM
for target in code archives; do
 [ ! -L "$CONTROL/$target" ] || exit 1
 mkdir -p "$CONTROL/$target"
 [ "$(readlink -f "$CONTROL/$target")" = "$CONTROL/$target" ] || exit 1
 chmod 700 "$CONTROL/$target"
done
if [ -e "$CONTROL/incoming" ]; then
 [ -d "$CONTROL/incoming" ] && [ ! -L "$CONTROL/incoming" ] && [ "$(readlink -f "$CONTROL/incoming")" = "$CONTROL/incoming" ] || exit 1
 saved=$CONTROL/archives/incoming-__CANDIDATE__-$(date +%Y%m%dT%H%M%S)-$$
 case "$saved" in "$CONTROL"/archives/*) ;; *) exit 1 ;; esac
 [ ! -e "$saved" ] || exit 1
 mv "$CONTROL/incoming" "$saved"
fi
mkdir -m 700 "$CONTROL/incoming"
cp "$SOURCE"/* "$CONTROL/incoming/"
mkdir -p "$CONTROL/code/deploy-controller" "$CONTROL/code/scripts/ci"
chmod 700 "$CONTROL/code/deploy-controller" "$CONTROL/code/scripts" "$CONTROL/code/scripts/ci"
for file in nas-preproduction.sh sqlite-snapshot.cjs validate-bundle.cjs; do cp "$KIT/code/deploy-controller/$file" "$CONTROL/code/deploy-controller/$file"; done
for file in common.cjs contracts.cjs; do cp "$KIT/code/scripts/ci/$file" "$CONTROL/code/scripts/ci/$file"; done
cp "$KIT/approval.json" "$CONTROL/approval.json"
cp "$KIT/env.preprod.example" "$CONTROL/.env.preprod"
chmod 600 "$CONTROL/approval.json" "$CONTROL/.env.preprod"
rmdir "$CONTROL/.deployment-lock"
trap - EXIT
sh "$CONTROL/code/deploy-controller/nas-preproduction.sh" plan
echo NAS_PREPARATION_PLAN_OK
