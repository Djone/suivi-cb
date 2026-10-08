# Contrôles NAS avant validation du package

> Mode opératoire détaillé : [HTTPS, parcours, CSP et scans](./VERIFICATIONS_RC2_GUIDE.md).
> Restaurations : [lectures SQLite et connexion Keycloak isolées](./RESTAURATIONS_APPLICATIVES_ISOLEES.md).


## Avant ces commandes : installer la rc2

Suivre d’abord [la checklist rc2 détaillée](./CHECKLIST_RC2_PREPRODUCTION.md) :
architecture et dossiers sur le NAS, construction/export/inspection sur le PC,
transfert du tar, docker load et démarrage sans build en préproduction. Les
sections 1 à 3 ci-dessous s’exécutent ensuite **sur le NAS, dans une session SSH**.
La section 4 combine des observations navigateur et la préparation d’une
nouvelle candidate si la CSP change.

L’audit du 8 octobre 2026 refuse l’archive `suivi-cb-preprod-2.2.0-rc1.tar` :
base SQLite embarquée et configuration SSO absente de l’image frontend.
Les corrections locales nécessitent une nouvelle candidate, par exemple rc2,
à construire puis installer et valider **en préproduction** avant promotion. Ne pas remplacer
le package de production par un build local non testé sur le NAS.

Connecter : `ssh GodOfNasAugerie@192.168.1.113 -p 1122`.
Copier `scripts/audit-sqlite-restore.cjs` dans
`/volume1/docker/suivi-cb-preprod/audit-tools/` (hors image).
Exécuter les blocs séparément et conserver les sorties sans secrets.

## 1. Relever les images et contrôles de la candidate

```sh
cd /volume1/docker/suivi-cb-preprod
sudo docker compose -p suivi-cb-preprod -f docker-compose.yml config --quiet
sudo docker compose -p suivi-cb-preprod -f docker-compose.yml ps
sudo docker compose -p suivi-cb-preprod -f docker-compose.yml exec frontend nginx -t
sudo docker inspect --format '{{.Name}} {{.Image}} {{json .NetworkSettings.Ports}}' suivi-cb-preprod-backend suivi-cb-preprod-frontend
sudo docker exec suivi-cb-preprod-frontend sh -c 'grep -A 10 "location = /silent-check-sso.html" /etc/nginx/nginx.conf'
curl -sS -D - -o /dev/null https://finances-preprod.jolurie.com/
curl -sS -D - -o /dev/null https://finances-preprod.jolurie.com/api/accounts
curl -sS -H 'Authorization: Bearer invalid' -D - -o /dev/null https://finances-preprod.jolurie.com/api/accounts
curl -sS -D - -o /dev/null https://finances-preprod.jolurie.com/silent-check-sso.html
curl -sS -D - -o /dev/null http://finances-preprod.jolurie.com/
curl -fsS https://auth.jolurie.com/realms/suivi-cb-preprod/.well-known/openid-configuration
```

Attendus : services healthy, aucun port backend publié, deux refus 401,
SSO 200 + SAMEORIGIN, realm correct, HTTP redirigé vers HTTPS. Activer HSTS
sur la règle HTTPS DSM, puis vérifier `Strict-Transport-Security` sur les
réponses. Vérifier également le domaine de production avant la MEP.

Tester au navigateur les accès 403 sans rôle et les accès autorisés, la session,
le SMTP et l’OTP, y compris la désactivation OTP avec réauthentification requise
par Keycloak. Ne pas transmettre de jetons dans le compte rendu.

## 2. SQLite : restauration isolée de la base de préproduction

Ce bloc suspend brièvement **le backend de préproduction**, copie tout son
dossier de données, le redémarre, puis vérifie une restauration dans un
conteneur sans réseau. Il ne touche pas aux conteneurs ni aux données de production.
La sauvegarde de production avant MEP reste obligatoire.

```sh
sudo sh <<'SH'
set -eu
umask 077
cd /volume1/docker/suivi-cb-preprod
[ "$(pwd -P)" = /volume1/docker/suivi-cb-preprod ]
[ -f data/database.db ]
[ -f audit-tools/audit-sqlite-restore.cjs ]
AUDIT_DIR=$(mktemp -d /volume1/docker/suivi-cb-preprod/backups/audit-restore-XXXXXX)
BACKEND_IMAGE=$(docker inspect --format '{{.Image}}' suivi-cb-preprod-backend)
trap 'docker compose -p suivi-cb-preprod -f docker-compose.yml start backend >/dev/null' EXIT
docker compose -p suivi-cb-preprod -f docker-compose.yml stop backend
cp -a data "$AUDIT_DIR/source"
docker compose -p suivi-cb-preprod -f docker-compose.yml start backend
trap - EXIT
mkdir "$AUDIT_DIR/result"
docker run --rm --network none --read-only --tmpfs /tmp \
  --mount "type=bind,source=$AUDIT_DIR/source,target=/source,readonly" \
  --mount "type=bind,source=$AUDIT_DIR/result,target=/audit" \
  --mount "type=bind,source=/volume1/docker/suivi-cb-preprod/audit-tools/audit-sqlite-restore.cjs,target=/audit-tools/check.cjs,readonly" \
  --entrypoint node "$BACKEND_IMAGE" /audit-tools/check.cjs > "$AUDIT_DIR/result/report.json"
cat "$AUDIT_DIR/result/report.json"
printf 'Dossier de preuve protégé : %s\n' "$AUDIT_DIR"
SH
```

Attendus : `integrity: ok`, `foreignKeys: ok`, `restoration: ok` et nombres
de lignes identiques entre snapshot et restauration. Conserver le dossier sous
droits restrictifs ; transmettre seulement le rapport. Compléter par un test
fonctionnel de lecture sur une pile applicative isolée utilisant cette restauration.
[SQLite documente VACUUM INTO comme une sauvegarde cohérente](https://www.sqlite.org/lang_vacuum.html).

## 3. PostgreSQL : dump et restauration sans réseau

Identifier d’abord le conteneur PostgreSQL de Keycloak avec
`sudo docker ps --format '{{.Names}} {{.Image}}'`. Remplacer la valeur
`REMPLACER_CONTENEUR_POSTGRES` ci-dessous par ce nom. La base/utilisateur
`keycloak` correspondent au Compose du dépôt ; les adapter si l’installation diffère.
Dans le Compose fourni, ce nom est `keycloak-postgres` : utiliser
`PG_SOURCE=keycloak-postgres` si la liste des conteneurs le confirme.
La valeur de remplacement provoque un arrêt avant toute sauvegarde/restauration.
Le dump lit la base existante ; la restauration cible un nouveau conteneur isolé,
sans port, sans réseau et avec une base en mémoire temporaire.

```sh
sudo sh <<'SH'
set -eu
umask 077
PG_SOURCE=keycloak-postgres
if ! docker inspect "$PG_SOURCE" >/dev/null 2>&1; then
  printf 'ERREUR : conteneur introuvable : %s\n' "$PG_SOURCE" >&2
  exit 1
fi
printf 'Source PostgreSQL : %s\n' "$PG_SOURCE"
cd /volume1/docker/keycloak
mkdir -p backups
chmod 700 backups
AUDIT_DIR=$(mktemp -d /volume1/docker/keycloak/backups/audit-restore-XXXXXX)
PG_IMAGE=$(docker inspect --format '{{.Image}}' "$PG_SOURCE")
docker exec "$PG_SOURCE" pg_dump -U keycloak -d keycloak -Fc > "$AUDIT_DIR/keycloak.dump"
[ -s "$AUDIT_DIR/keycloak.dump" ]
PG_RESTORE=$(docker run -d --network none --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_USER=keycloak -e POSTGRES_DB=keycloak \
  -e POSTGRES_HOST_AUTH_METHOD=trust "$PG_IMAGE")
trap 'docker rm -f "$PG_RESTORE" >/dev/null' EXIT
READY=0
for N in 1 2 3 4 5 6 7 8 9 10; do
  if docker exec "$PG_RESTORE" pg_isready -U keycloak -d keycloak >/dev/null 2>&1; then READY=1; break; fi
  sleep 2
done
if [ "$READY" != 1 ]; then
  printf '%s\n' 'ERREUR : la base isolee ne devient pas disponible.' >&2
  docker logs --tail=50 "$PG_RESTORE" >&2
  exit 1
fi
docker exec -i "$PG_RESTORE" pg_restore -U keycloak -d keycloak \
  --exit-on-error --no-owner --no-privileges < "$AUDIT_DIR/keycloak.dump"
docker exec "$PG_RESTORE" psql -U keycloak -d keycloak -v ON_ERROR_STOP=1 -At \
  -c 'SELECT count(*) AS realms FROM realm; SELECT count(*) AS users FROM user_entity; SELECT count(*) AS clients FROM client;' > "$AUDIT_DIR/restored-counts.txt"
cat "$AUDIT_DIR/restored-counts.txt"
printf 'Restauration PostgreSQL terminée sans erreur. Dossier protégé : %s\n' "$AUDIT_DIR"
SH
```

Le bloc utilise le même identifiant d’image PostgreSQL que la source. Pour
PostgreSQL 18 et ultérieur, vérifier PGDATA et adapter le montage tmpfs au
répertoire de données de cette image avant exécution. Le Compose du dépôt
utilise PostgreSQL 17. Le mode trust est limité au conteneur sans réseau et
sans port ; ne pas le reprendre dans la configuration réelle.

Cette restauration vérifie le dump et les tables, pas une connexion Keycloak
complète. Compléter dans une pile Keycloak isolée : realm attendu et connexion
d’un compte de test, sans SMTP actif ni raccordement au reverse proxy public.
Ne pas ouvrir de session utilisateur réelle sur cette pile. Conserver les thèmes,
la configuration et les secrets nécessaires dans le coffre de sauvegarde.
[pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) et
[pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html).

## 4. CSP et nouvelle archive

La CSP ajoutée dans `nginx.conf` est **Report-Only**, pas encore appliquée.
Construire puis installer la candidate de préproduction avec les corrections du dépôt ;
observer les violations dans la console navigateur sur tous les parcours,
y compris les styles Angular/PrimeNG, polices, graphiques, Keycloak et SSO.
La page SSO charge `/silent-check-sso.js` depuis la même origine, autorisée
par `script-src self` ; elle ne nécessite pas d’autoriser des scripts inline. Les styles inline sont provisoirement autorisés pour compatibilité.
Quand la politique est validée, l’activer, reconstruire et refaire les tests.
La syntaxe Nginx seule ne valide pas la compatibilité navigateur.

Exporter **les images définitivement validées en préproduction** vers une
nouvelle archive, puis l’inspecter avec `scripts/audit-image-archive.mjs`.
Aucune base/secrets ne doit apparaître dans ses couches, et l’image frontend
doit contenir la correction SSO et la politique validée. Faire analyser aussi
les composants système Alpine/Node/Nginx par un scanner d’images connecté.
La décision sur les alertes npm de développement reste à consigner.
