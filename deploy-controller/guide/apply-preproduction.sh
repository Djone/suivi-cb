#!/bin/sh
set -eu
umask 077
[ "$(id -u)" = 0 ] || exit 1
CONTROL=/volume1/docker/suivi-cb-deployment-control
[ "$(readlink -f "$CONTROL")" = "$CONTROL" ] && [ "$(stat -c %u:%a "$CONTROL")" = 0:700 ] || exit 1
# Intentional operator action, preproduction only. Remove the local enable flag on exit.
[ ! -L "$CONTROL/ENABLE_PREPRODUCTION_APPLY" ] || exit 1
: > "$CONTROL/ENABLE_PREPRODUCTION_APPLY"
chmod 600 "$CONTROL/ENABLE_PREPRODUCTION_APPLY"
trap 'rm -f "$CONTROL/ENABLE_PREPRODUCTION_APPLY"' EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM
sh "$CONTROL/code/deploy-controller/nas-preproduction.sh" apply
