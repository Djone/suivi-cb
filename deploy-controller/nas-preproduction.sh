#!/bin/sh
# Install reviewed code as root. No polling, SSH exposure or production command.
set -eu
umask 077
CONTROL=/volume1/docker/suivi-cb-deployment-control
APP=/volume1/docker/suivi-cb-ci-preprod
PROJECT=suivi-cb-ci-preprod
BACKEND=suivi-cb-ci-preprod-backend
FRONTEND=suivi-cb-ci-preprod-frontend
NODE_IMAGE=node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
MODE=${1:-plan}
case "$MODE" in plan|apply) ;; *) echo 'Only plan or apply is accepted.' >&2; exit 1 ;; esac
[ "$#" -le 2 ] || exit 1
if [ "$#" = 2 ]; then printf '%s\n' "$2" | grep -Eq '^[a-f0-9]{64}$' || exit 1; fi
[ "$(id -u)" = 0 ] || { echo 'Controlled root task required.' >&2; exit 1; }
[ ! -L "$CONTROL" ] && [ "$(readlink -f "$CONTROL")" = "$CONTROL" ] || exit 1
[ "$(stat -c %u:%a "$CONTROL")" = 0:700 ] || exit 1
for target in "$CONTROL/code" "$CONTROL/incoming"; do
  [ -d "$target" ] && [ ! -L "$target" ] && [ "$(readlink -f "$target")" = "$target" ] && [ "$(stat -c %u:%a "$target")" = 0:700 ] || exit 1
done
for target in "$CONTROL/approval.json" "$CONTROL/.env.preprod"; do
  [ -f "$target" ] && [ ! -L "$target" ] && [ "$(stat -c %u:%a "$target")" = 0:600 ] || exit 1
done
mkdir "$CONTROL/.deployment-lock" || { echo 'Another deployment/preparation is active.' >&2; exit 1; }
validated=
trap 'if [ -n "$validated" ]; then rm -f "$validated"; fi; rmdir "$CONTROL/.deployment-lock"' EXIT
# Optional expected manifest fingerprint adds binding under the deployment lock.
if [ "$#" = 2 ]; then
  [ "$(sha256sum "$CONTROL/incoming/manifest.json" | cut -d ' ' -f1)" = "$2" ] || { echo 'DSM_MANIFEST_CHANGED' >&2; exit 1; }
fi
validated=$(mktemp "$CONTROL/.validated.XXXXXX")
trap 'exit 130' INT
trap 'exit 143' HUP TERM
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
  --memory 96m --pids-limit 64 --user 0:0 \
  --mount "type=bind,source=$CONTROL/code,target=/control,readonly" \
  --mount "type=bind,source=$CONTROL/incoming,target=/bundle,readonly" \
  --mount "type=bind,source=$CONTROL/approval.json,target=/approval.json,readonly" \
  --mount "type=bind,source=$CONTROL/.env.preprod,target=/preprod.env,readonly" \
  --entrypoint node "$NODE_IMAGE" /control/deploy-controller/validate-bundle.cjs \
  /bundle /approval.json /preprod.env > "$validated"
{
  IFS= read -r version
  IFS= read -r commit
  IFS= read -r backend_tag
  IFS= read -r backend_local_id
  IFS= read -r backend_config_id
  IFS= read -r frontend_tag
  IFS= read -r frontend_local_id
  IFS= read -r frontend_config_id
  IFS= read -r qualification_run
} < "$validated"
printf 'Target=preproduction Candidate=%s Commit=%s Run=%s Port=127.0.0.1:4205\n' "$version" "$commit" "$qualification_run"
printf 'Backend=%s Frontend=%s\n' "$backend_config_id" "$frontend_config_id"
[ "$MODE" = apply ] || { echo 'PLAN_ONLY: no application service changed.'; exit 0; }
[ -f "$CONTROL/ENABLE_PREPRODUCTION_APPLY" ] && [ ! -L "$CONTROL/ENABLE_PREPRODUCTION_APPLY" ] || { echo 'Application disabled locally.' >&2; exit 1; }
[ "$(stat -c %u:%a "$CONTROL/ENABLE_PREPRODUCTION_APPLY")" = 0:600 ] || exit 1
available=$(awk '/^MemAvailable:/ {print int($2/1024)}' /proc/meminfo)
[ -n "$available" ] && [ "$available" -ge 512 ] || { echo 'At least 512 MiB MemAvailable required.' >&2; exit 1; }
# Existing resources must belong to this separate, fixed project.
for name in "$BACKEND" "$FRONTEND"; do
  if docker container inspect "$name" >/dev/null 2>&1; then
    [ "$(docker inspect --format '{{index .Config.Labels "io.suivi.scope"}}' "$name")" = ci-preproduction ] || exit 1
  fi
done
[ ! -L "$APP" ] || exit 1
mkdir -p "$APP"
[ "$(readlink -f "$APP")" = "$APP" ] && [ "$(stat -c %u "$APP")" = 0 ] || exit 1
[ ! -L "$APP/data" ] && [ ! -L "$APP/receipts" ] || exit 1
mkdir -p "$APP/data" "$APP/receipts"
chmod 700 "$APP" "$APP/data" "$APP/receipts"
chown 1028:100 "$APP/data"
[ ! -f "$APP/receipts/$version.json" ] || { echo 'Candidate already attempted; use a new candidate.' >&2; exit 1; }
# Loading is a transport operation: no Docker build exists in this script.
docker load -i "$CONTROL/incoming/images.tar" >/dev/null
backend_id=$(docker image inspect --format '{{.Id}}' "$backend_tag")
frontend_id=$(docker image inspect --format '{{.Id}}' "$frontend_tag")
[ "$backend_id" = "$backend_local_id" ] || [ "$backend_id" = "$backend_config_id" ] || exit 1
[ "$frontend_id" = "$frontend_local_id" ] || [ "$frontend_id" = "$frontend_config_id" ] || exit 1
for image in "$backend_id" "$frontend_id"; do
  [ "$(docker image inspect --format '{{.Architecture}}' "$image")" = amd64 ] || exit 1
  [ "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")" = "$commit" ] || exit 1
done
[ "$(docker image inspect --format '{{.Config.User}}' "$backend_id")" = 1028:100 ] || exit 1
[ "$(docker image inspect --format '{{.Config.User}}' "$frontend_id")" = nginx ] || exit 1
# Snapshot the isolated preproduction database before a migration, never production.
if docker container inspect "$BACKEND" >/dev/null 2>&1; then
  mounted=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Source}}{{end}}{{end}}' "$BACKEND")
  [ "$mounted" = "$APP/data" ] || exit 1
  docker cp "$CONTROL/code/deploy-controller/sqlite-snapshot.cjs" "$BACKEND:/tmp/suivi-snapshot.cjs"
  docker exec "$BACKEND" node /tmp/suivi-snapshot.cjs "/app/data/.deployment-backups/$version.db" > "$APP/receipts/$version-backup.json"
fi
if [ -f "$APP/docker-compose.yml" ]; then
  [ ! -L "$APP/docker-compose.yml" ] || exit 1
  cp "$APP/docker-compose.yml" "$APP/receipts/$version-previous-compose.yml"
fi
cat > "$APP/docker-compose.yml" <<YAML
name: $PROJECT
services:
  backend:
    image: $backend_id
    pull_policy: never
    container_name: $BACKEND
    restart: unless-stopped
    labels: {io.suivi.scope: ci-preproduction}
    env_file: [$CONTROL/.env.preprod]
    environment:
      NODE_ENV: production
      DOCUMENTATION_DISABLED: "true"
      PORT_BACK: "3001"
      DB_PATH: /app/data/database.db
    volumes: [$APP/data:/app/data]
    cap_drop: [ALL]
    security_opt: [no-new-privileges:true]
    mem_limit: 192m
    pids_limit: 128
    healthcheck:
      test: [CMD, node, -e, "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 5s
      timeout: 3s
      retries: 12
      start_period: 15s
  frontend:
    image: $frontend_id
    pull_policy: never
    container_name: $FRONTEND
    restart: unless-stopped
    labels: {io.suivi.scope: ci-preproduction}
    ports: [127.0.0.1:4205:8080]
    depends_on: {backend: {condition: service_healthy}}
    cap_drop: [ALL]
    security_opt: [no-new-privileges:true]
    mem_limit: 64m
    pids_limit: 64
    healthcheck:
      test: [CMD, wget, -q, -O, /dev/null, http://127.0.0.1:8080/]
      interval: 5s
      timeout: 3s
      retries: 12
      start_period: 10s
YAML
status=FAILED_CURRENT_DATABASE_PRESERVED
if docker compose -p "$PROJECT" -f "$APP/docker-compose.yml" config -q && \
   docker compose -p "$PROJECT" -f "$APP/docker-compose.yml" up -d --no-build; then
  ready=false
  for attempt in $(seq 1 60); do
    if [ "$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$BACKEND")" = healthy ] && \
       [ "$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$FRONTEND")" = healthy ]; then ready=true; break; fi
    sleep 2
  done
  if [ "$ready" = true ] && \
     [ "$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:4205/)" = 200 ] && \
     [ "$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:4205/api/accounts/active)" = 401 ]; then
    status=NAS_SMOKE_PASS_PENDING_HUMAN_ACCEPTANCE
  fi
fi
# Values below come only from the strict validator or fixed literals, never shell evaluation.
cat > "$APP/receipts/$version.json" <<JSON
{"schema":1,"target":"preproduction","status":"$status","candidate":"$version","commit":"$commit","qualificationRun":"$qualification_run","backend":"$backend_config_id","frontend":"$frontend_config_id","databaseRestored":false,"productionApproved":false}
JSON
printf 'Receipt=%s/receipts/%s.json Status=%s\n' "$APP" "$version" "$status"
[ "$status" = NAS_SMOKE_PASS_PENDING_HUMAN_ACCEPTANCE ]
