#!/bin/sh
# Read-only verification of the newest run and the matching published copy.
set -eu
[ "$(id -u)" = 0 ] || exit 1
ROOT=/volume1/suivi-cb-backups
PUBLISHED=/volume1/SuiviCB-BackupVault/published
latest=
for directory in "$ROOT"/run-*; do
 [ -d "$directory" ] || continue
 [ ! -L "$directory" ] || exit 1
 latest=$directory
done
[ -n "$latest" ] || { echo NO_BACKUP_RUN >&2; exit 1; }
name=$(basename "$latest")
[ "$(cat "$latest/status.txt")" = SUCCESS ] || { echo LATEST_BACKUP_NOT_SUCCESS >&2; exit 1; }
(cd "$latest" && sha256sum -c SHA256SUMS)
[ -d "$PUBLISHED/$name" ] && [ ! -L "$PUBLISHED/$name" ] || { echo LATEST_RUN_NOT_PUBLISHED >&2; exit 1; }
[ "$(cat "$PUBLISHED/$name/status.txt")" = SUCCESS ] || exit 1
cmp "$latest/SHA256SUMS" "$PUBLISHED/$name/SHA256SUMS" >/dev/null
(cd "$PUBLISHED/$name" && sha256sum -c SHA256SUMS)
printf 'BACKUP_AND_PUBLICATION_OK run=%s\n' "$name"
echo 'USB remains a separate Hyper Backup verification of this exact run.'
