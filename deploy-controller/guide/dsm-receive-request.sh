#!/bin/sh
# Runs as the SSH account, never as root.
set -eu
PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
export PATH
umask 077
INBOX=/volume1/docker/suivi-cb-release-queue/inbox
[ "$#" = 0 ] && [ -d "$INBOX" ] && [ ! -L "$INBOX" ] && [ "$(readlink -f "$INBOX")" = "$INBOX" ] || exit 1
[ ! -e "$INBOX/request.json" ] && [ ! -L "$INBOX/request.json" ] || { echo REQUEST_PENDING >&2; exit 1; }
temporary=$(mktemp "$INBOX/.request.XXXXXX")
trap 'rm -f "$temporary"' EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM
dd bs=1 count=8193 of="$temporary" 2>/dev/null
[ "$(stat -c %s "$temporary")" -le 8192 ] || { echo REQUEST_TOO_LARGE >&2; exit 1; }
ln "$temporary" "$INBOX/request.json"
echo SUIVI_CB_REQUEST_QUEUED
