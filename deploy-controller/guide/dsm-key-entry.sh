#!/bin/sh
set -eu
PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
export PATH
QUEUE=/volume1/docker/suivi-cb-release-queue
case "${SSH_ORIGINAL_COMMAND:-}" in
  suivi-cb-probe) printf '%s\n' SUIVI_CB_SSH_READY ;;
  suivi-cb-queue) exec /usr/local/bin/suivi-cb-release-request ;;
  'suivi-cb-receipt '*)
    nonce=${SSH_ORIGINAL_COMMAND#suivi-cb-receipt }
    printf '%s\n' "$nonce" | grep -Eq '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' || exit 1
    FILE=$QUEUE/outbox/$nonce.json
    if [ -f "$FILE" ] && [ ! -L "$FILE" ]; then cat "$FILE"; else printf '%s\n' '{"pending":true}'; fi ;;
  *) echo 'Only release probe, bounded request and receipt are allowed' >&2; exit 1 ;;
esac
