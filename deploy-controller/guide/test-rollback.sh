#!/bin/sh
# Exact installed old image, fresh synthetic volume, no production mount/port/socket.
set -eu
umask 077
[ "$(id -u)" = 0 ] || exit 1
IMAGE=suivi-cb-ci-backend:__CANDIDATE__
OLD=$(docker inspect --format '{{.Image}}' suivi-cb-backend)
SUFFIX=__RUN__-$(date +%s)-$$
VOLUME=suivi-cb-rollback-$SUFFIX
NETWORK=$VOLUME
OLD_NAME=$VOLUME-old
NEW_NAME=$VOLUME-new
owned_container() { [ "$(docker inspect --format '{{index .Config.Labels "io.suivi.rollback"}}' "$1" 2>/dev/null)" = "$SUFFIX" ]; }
cleanup() {
 for name in "$NEW_NAME" "$OLD_NAME"; do if owned_container "$name"; then docker rm -f "$name" >/dev/null; fi; done
 if [ "$(docker volume inspect --format '{{index .Labels "io.suivi.rollback"}}' "$VOLUME" 2>/dev/null)" = "$SUFFIX" ]; then docker volume rm "$VOLUME" >/dev/null; fi
 if [ "$(docker network inspect --format '{{index .Labels "io.suivi.rollback"}}' "$NETWORK" 2>/dev/null)" = "$SUFFIX" ]; then docker network rm "$NETWORK" >/dev/null; fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM
! docker volume inspect "$VOLUME" >/dev/null 2>&1 || exit 1
! docker network inspect "$NETWORK" >/dev/null 2>&1 || exit 1
docker image inspect "$IMAGE" >/dev/null
docker network create --internal --label "io.suivi.rollback=$SUFFIX" "$NETWORK" >/dev/null
docker volume create --label "io.suivi.rollback=$SUFFIX" "$VOLUME" >/dev/null
wait_ready() {
 for attempt in $(seq 1 60); do
  if docker exec "$1" node -e "fetch('http://127.0.0.1:3001/api/accounts/active').then(r=>process.exit([200,401,403].includes(r.status)?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then return 0; fi
  [ "$(docker inspect --format '{{.State.Running}}' "$1")" = true ] || break
  sleep 2
 done
 echo 'ROLLBACK_EXERCISE_FAILED: inspect only the synthetic exercise containers.' >&2
 return 1
}
# The old image runs with its configured identity, reproducing the existing NAS image.
docker run -d --pull=never --name "$OLD_NAME" --label "io.suivi.rollback=$SUFFIX" --network "$NETWORK" --memory 192m --pids-limit 128 --security-opt no-new-privileges --mount "type=volume,source=$VOLUME,target=/app/data" -e PORT_BACK=3001 -e DB_PATH=/app/data/database.db -e KEYCLOAK_URL=https://synthetic.invalid "$OLD" >/dev/null
wait_ready "$OLD_NAME"
docker stop "$OLD_NAME" >/dev/null
# Ownership preparation affects this labelled synthetic volume only; no database restoration.
docker run --rm --network none --user 0:0 --mount "type=volume,source=$VOLUME,target=/app/data" --entrypoint sh "$IMAGE" -c 'chown -R 1028:100 /app/data'
docker run -d --pull=never --name "$NEW_NAME" --label "io.suivi.rollback=$SUFFIX" --network "$NETWORK" --memory 192m --pids-limit 128 --cap-drop ALL --security-opt no-new-privileges --mount "type=volume,source=$VOLUME,target=/app/data" -e PORT_BACK=3001 -e DB_PATH=/app/data/database.db -e KEYCLOAK_URL=https://synthetic.invalid "$IMAGE" >/dev/null
wait_ready "$NEW_NAME"
docker exec "$NEW_NAME" node -e "const d=require('./config/db');d.run('INSERT INTO accounts(name,is_active) VALUES (?,1)',['rollback-$SUFFIX'],e=>{if(e)throw e;d.close()})"
docker stop "$NEW_NAME" >/dev/null
docker start "$OLD_NAME" >/dev/null
wait_ready "$OLD_NAME"
query="const d=require('./config/db');d.get('SELECT count(*) n FROM accounts WHERE name=?',['rollback-$SUFFIX'],(e,r)=>{if(e||r.n!==1)process.exit(1);console.log('ROLLBACK_DATA_OK');d.close()})"
docker exec "$OLD_NAME" node -e "$query" | grep -q ROLLBACK_DATA_OK
docker stop "$OLD_NAME" >/dev/null
docker start "$NEW_NAME" >/dev/null
wait_ready "$NEW_NAME"
docker exec "$NEW_NAME" node -e "$query" | grep -q ROLLBACK_DATA_OK
printf 'NAS_ROLLBACK_OK candidate=__CANDIDATE__ old=%s volume=%s\n' "$OLD" "$VOLUME"
