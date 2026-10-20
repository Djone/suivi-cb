#!/bin/sh
# Install once after reviewing the kit. Does not enable deployment or create DSM tasks.
set -eu
PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
export PATH
umask 077
[ "$(id -u)" = 0 ] && [ "$#" = 0 ] || exit 1
KIT=$(CDPATH= cd "$(dirname "$0")" && pwd -P)
CONTROL=/volume1/docker/suivi-cb-deployment-control
QUEUE=/volume1/docker/suivi-cb-release-queue
(cd "$KIT" && sha256sum -c SHA256SUMS)
[ ! -e "$QUEUE" ] && [ ! -L "$QUEUE" ] || { echo 'Queue already exists: inspect before upgrading'; exit 1; }
for P in /usr/local/bin /volume1/docker; do
  [ -d "$P" ] && [ ! -L "$P" ] || exit 1
done
[ -f /usr/local/bin/suivi-cb-key-entry ] && [ ! -L /usr/local/bin/suivi-cb-key-entry ] || exit 1
[ "$(stat -c %u /usr/local/bin/suivi-cb-key-entry)" = 0 ] || exit 1
[ "$(sha256sum /usr/local/bin/suivi-cb-key-entry | cut -d ' ' -f1)" = '__ENTRY_SHA__' ] || { echo 'Unexpected SSH entrypoint: no replacement performed'; exit 1; }
[ ! -e /usr/local/bin/suivi-cb-release-request ] && [ ! -L /usr/local/bin/suivi-cb-release-request ] || exit 1
[ ! -L "$CONTROL" ] || exit 1
mkdir -p "$CONTROL"
[ "$(readlink -f "$CONTROL")" = "$CONTROL" ] || exit 1
chown 0:0 "$CONTROL"
if [ -x /usr/syno/bin/synoacltool ] && /usr/syno/bin/synoacltool -get "$CONTROL" >/dev/null 2>&1; then /usr/syno/bin/synoacltool -del "$CONTROL" >/dev/null; fi
chmod 700 "$CONTROL"
mkdir "$CONTROL/.deployment-lock" || exit 1
trap 'rmdir "$CONTROL/.deployment-lock"' EXIT
for P in "$CONTROL/code" "$CONTROL/code/deploy-controller" "$CONTROL/code/scripts" "$CONTROL/code/scripts/ci"; do
  [ ! -L "$P" ] || exit 1
  if [ ! -e "$P" ]; then mkdir "$P"; fi
  [ -d "$P" ] && [ "$(readlink -f "$P")" = "$P" ] || exit 1
  chown 0:0 "$P"; chmod 700 "$P"
done
for FILE in nas-preproduction.sh sqlite-snapshot.cjs validate-bundle.cjs dsm-request.cjs dsm-worker.sh; do
  SOURCE=$KIT/code/deploy-controller/$FILE
  TARGET=$CONTROL/code/deploy-controller/$FILE
  [ -f "$SOURCE" ] && [ ! -L "$SOURCE" ] && [ ! -L "$TARGET" ] || exit 1
  cp "$SOURCE" "$TARGET"; chown 0:0 "$TARGET"; chmod 600 "$TARGET"
done
for FILE in common.cjs contracts.cjs; do
  SOURCE=$KIT/code/scripts/ci/$FILE
  TARGET=$CONTROL/code/scripts/ci/$FILE
  [ -f "$SOURCE" ] && [ ! -L "$SOURCE" ] && [ ! -L "$TARGET" ] || exit 1
  cp "$SOURCE" "$TARGET"; chown 0:0 "$TARGET"; chmod 600 "$TARGET"
done
mkdir "$QUEUE"
chown 0:0 "$QUEUE"; chmod 755 "$QUEUE"
if [ -x /usr/syno/bin/synoacltool ] && /usr/syno/bin/synoacltool -get "$QUEUE" >/dev/null 2>&1; then /usr/syno/bin/synoacltool -del "$QUEUE" >/dev/null; fi
chmod 755 "$QUEUE"
mkdir "$QUEUE/inbox" "$QUEUE/outbox"
chown GodOfNasAugerie "$QUEUE/inbox"; chmod 700 "$QUEUE/inbox"
chown 0:0 "$QUEUE/outbox"; chmod 755 "$QUEUE/outbox"
for FILE in dsm-receive-request.sh dsm-key-entry.sh; do [ -f "$KIT/$FILE" ] && [ ! -L "$KIT/$FILE" ] || exit 1; done
cp "$KIT/dsm-receive-request.sh" /usr/local/bin/suivi-cb-release-request
chown 0:0 /usr/local/bin/suivi-cb-release-request; chmod 755 /usr/local/bin/suivi-cb-release-request
entry=$(mktemp /usr/local/bin/.suivi-entry.XXXXXX)
cp "$KIT/dsm-key-entry.sh" "$entry"
chown 0:0 "$entry"; chmod 755 "$entry"
mv "$entry" /usr/local/bin/suivi-cb-key-entry
echo DSM_EXECUTOR_INSTALLED_PLAN_ONLY
echo 'Create a DSM scheduled task as root, every minute, with:'
echo 'sh /volume1/docker/suivi-cb-deployment-control/code/deploy-controller/dsm-worker.sh'
echo 'Do not enable apply until the plan and isolated tests have passed.'
