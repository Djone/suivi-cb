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
# First installation is deliberately diagnostic-only: no sudoers modification.
[ -d /usr/local/bin ] && [ ! -L /usr/local/bin ] && [ "$(stat -c %u /usr/local/bin)" = 0 ] || { echo '/usr/local/bin must be a trusted root-owned directory'; exit 1; }
[ ! -e /usr/local/bin/suivi-cb-key-entry ] && [ ! -L /usr/local/bin/suivi-cb-key-entry ] || { echo 'Installation exists; inspect before replacing'; exit 1; }
cat > /usr/local/bin/suivi-cb-key-entry <<'ENTRY'
#!/bin/sh
set -eu
case "${SSH_ORIGINAL_COMMAND:-}" in
  suivi-cb-probe) printf '%s\n' SUIVI_CB_SSH_READY ;;
  *) echo 'Diagnostic key only: deployment executor is not installed' >&2; exit 1 ;;
esac
ENTRY
chmod 755 /usr/local/bin/suivi-cb-key-entry
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
echo SSH_KEY_INSTALLED_PROBE_ONLY
