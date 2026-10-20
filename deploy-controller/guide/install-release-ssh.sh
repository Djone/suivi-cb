#!/bin/sh
# Review and run once as root on NAS. No application service is changed.
set -eu
umask 077
[ "$(id -u)" = 0 ] || { echo 'Run with sudo sh'; exit 1; }
ACCOUNT=GodOfNasAugerie
PUBLIC_KEY='__PUBLIC_KEY__'
case "$PUBLIC_KEY" in 'ssh-ed25519 '*suivi-cb-release-local) ;; *) exit 1 ;; esac
HOME_DIR=$(awk -F: -v account="$ACCOUNT" '$1 == account { print $6; found++ } END { if (found != 1) exit 1 }' /etc/passwd)
[ -n "$HOME_DIR" ] && [ -d "$HOME_DIR" ] && [ ! -L "$HOME_DIR/.ssh" ] || exit 1
# Never silently change global sudo policy on Synology.
grep -Eq '^[#@]includedir[[:space:]]+/etc/sudoers.d/?[[:space:]]*$' /etc/sudoers || { echo 'Ask maintainer to verify sudoers include directory'; exit 1; }
command -v visudo >/dev/null || { echo 'visudo required'; exit 1; }
for P in /usr/local/bin /usr/local/sbin /etc/sudoers.d; do
  [ -d "$P" ] && [ ! -L "$P" ] && [ "$(stat -c %u "$P")" = 0 ] || exit 1
done
# Refuse overwriting an installation. Revisions require operator review.
for P in /usr/local/bin/suivi-cb-key-entry /usr/local/sbin/suivi-cb-release-gateway /etc/sudoers.d/suivi-cb-release; do
  [ ! -e "$P" ] && [ ! -L "$P" ] || { echo 'Installation exists; inspect before replacing'; exit 1; }
done
cat > /usr/local/bin/suivi-cb-key-entry <<'ENTRY'
#!/bin/sh
set -eu
set -f
case "${SSH_ORIGINAL_COMMAND:-}" in
  suivi-cb-probe) printf '%s\n' SUIVI_CB_SSH_READY ;;
  suivi-cb-plan) exec sudo -n /usr/local/sbin/suivi-cb-release-gateway plan ;;
  *) echo 'Only release probe and preproduction plan are allowed' >&2; exit 1 ;;
esac
ENTRY
cat > /usr/local/sbin/suivi-cb-release-gateway <<'GATEWAY'
#!/bin/sh
set -eu
[ "$(id -u)" = 0 ] && [ "$#" = 1 ] && [ "$1" = plan ] || exit 1
CONTROL=/volume1/docker/suivi-cb-deployment-control
[ ! -L "$CONTROL" ] && [ "$(readlink -f "$CONTROL")" = "$CONTROL" ] && [ "$(stat -c %u:%a "$CONTROL")" = 0:700 ] || exit 1
SCRIPT=$CONTROL/code/deploy-controller/nas-preproduction.sh
for P in "$CONTROL/code" "$CONTROL/code/deploy-controller" "$SCRIPT"; do
  [ ! -L "$P" ] && [ "$(stat -c %u "$P")" = 0 ] || exit 1
  mode=$(stat -c %a "$P")
  [ "$((0$mode & 022))" -eq 0 ] || exit 1
done
exec /bin/sh "$SCRIPT" plan
GATEWAY
chmod 755 /usr/local/bin/suivi-cb-key-entry
chmod 700 /usr/local/sbin/suivi-cb-release-gateway
printf '%s\n' 'GodOfNasAugerie ALL=(root) NOPASSWD: /usr/local/sbin/suivi-cb-release-gateway plan' > /etc/sudoers.d/suivi-cb-release
chmod 440 /etc/sudoers.d/suivi-cb-release
if ! visudo -cf /etc/sudoers.d/suivi-cb-release; then
  rm /etc/sudoers.d/suivi-cb-release
  echo 'Invalid sudo fragment removed; installation incomplete' >&2
  exit 1
fi
mkdir -p "$HOME_DIR/.ssh"
[ ! -L "$HOME_DIR/.ssh/authorized_keys" ] || exit 1
# Keep all existing login keys. This new key has no shell, forwarding, PTY or file transfer.
if [ -f "$HOME_DIR/.ssh/authorized_keys" ] && grep -F "$PUBLIC_KEY" "$HOME_DIR/.ssh/authorized_keys" >/dev/null; then
  echo 'Key exists: inspect its restrictions before proceeding'; exit 1
fi
printf '\n%s %s\n' 'command="/usr/local/bin/suivi-cb-key-entry",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty' "$PUBLIC_KEY" >> "$HOME_DIR/.ssh/authorized_keys"
chown "$ACCOUNT" "$HOME_DIR/.ssh" "$HOME_DIR/.ssh/authorized_keys"
chmod 700 "$HOME_DIR/.ssh"
chmod 600 "$HOME_DIR/.ssh/authorized_keys"
echo SSH_KEY_INSTALLED_PLAN_ONLY
