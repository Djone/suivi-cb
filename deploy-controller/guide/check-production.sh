#!/bin/sh
# Read-only checks. Does not stop, replace, rebuild or restore anything.
set -eu
sudo docker inspect --format 'Name={{.Name}} Image={{.Image}} Health={{if .State.Health}}{{.State.Health.Status}}{{end}} OOMKilled={{.State.OOMKilled}}' suivi-cb-backend suivi-cb-frontend
curl -fsS http://127.0.0.1:4200/api/auth/config
printf '\nFrontend HTTP='
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4200/
printf 'API without token HTTP='
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4200/api/accounts/active
