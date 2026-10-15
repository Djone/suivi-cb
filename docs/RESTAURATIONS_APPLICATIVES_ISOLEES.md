# Vérification applicative des restaurations isolées

Ces commandes se lancent après les restaurations du guide AUDIT_SECURITE_NAS.md.
Les chemins audit-restore-REMPLACER doivent être remplacés par les dossiers affichés
à la fin de ces restaurations. Exécuter chaque étape séparément et arrêter au premier
échec. Ne jamais monter la base active dans ces conteneurs de test.

## 1. SQLite : backend distinct sur une copie restaurée

**NAS, session SSH** : définir le dossier et vérifier le fichier. Le résultat doit
être RESTORED_DB_OK ; sinon corriger le chemin avant de poursuivre.

```sh
SQLITE_AUDIT_DIR=/volume1/docker/suivi-cb-preprod/backups/audit-restore-YYYUCc
sudo test -s "$SQLITE_AUDIT_DIR/result/restored.db" && echo RESTORED_DB_OK
BACKEND_IMAGE=$(sudo docker inspect --format '{{.Image}}' suivi-cb-preprod-backend)
printf 'Image backend : %s
' "$BACKEND_IMAGE"
```

Vérifier que le port 4302 et le nom suivant sont libres. Lancer uniquement le
backend distinct ; il peut accéder au Keycloak de préproduction pour vérifier
les jetons. La base montée est la copie restaurée, qui peut recevoir les migrations.
Le snapshot initial du dossier d’audit est conservé.

```sh
sudo docker run -d --name suivi-cb-audit-sqlite-backend   -p 127.0.0.1:4302:3001   --mount "type=bind,source=$SQLITE_AUDIT_DIR/result,target=/app/data"   -e NODE_ENV=production -e PORT_BACK=3001 -e DB_PATH=/app/data/restored.db   -e KEYCLOAK_URL=https://auth.jolurie.com -e KEYCLOAK_REALM=suivi-cb-preprod   -e KEYCLOAK_CLIENT_ID=suivi-cb-web -e KEYCLOAK_AUDIENCE=suivi-cb-api   "$BACKEND_IMAGE"
sudo docker logs --tail 50 suivi-cb-audit-sqlite-backend
curl -i http://127.0.0.1:4302/health
```

Attendre un démarrage sans erreur et une réponse de santé 200. Vérifier les noms
des variables Keycloak contre .env.preprod avant le lancement ; reprendre les
valeurs publiques utilisées par le backend réel si elles diffèrent.

**PC, une fenêtre PowerShell dédiée** : ouvrir le tunnel et laisser cette fenêtre ouverte.

```powershell
ssh -N -L 4302:127.0.0.1:4302 -p 1122 GodOfNasAugerie@192.168.1.113
```

Dans le navigateur, se connecter à la préproduction avec un compte de test app-user.
Dans F12 > Réseau, sélectionner une requête /api/accounts et copier uniquement
la valeur du jeton Authorization, sans le préfixe Bearer. Ne pas envoyer ce jeton.
**PC, une deuxième fenêtre PowerShell** : le saisir à l’invite masquée.

```powershell
$SecureToken = Read-Host 'Jeton du compte de test, sans Bearer' -AsSecureString
try {
    $Token = [System.Net.NetworkCredential]::new('', $SecureToken).Password
    $Headers = @{ Authorization = 'Bearer ' + $Token }
    $Accounts = Invoke-RestMethod 'http://localhost:4302/api/accounts' -Headers $Headers
    $Transactions = Invoke-RestMethod 'http://localhost:4302/api/transactions' -Headers $Headers
    Write-Host 'Lecture comptes et transactions restaurees : OK'
    # Examiner les objets localement pour retrouver les donnees de test attendues.
} finally {
    Remove-Variable Token, Headers, SecureToken -ErrorAction SilentlyContinue
}
```

Résultat attendu : deux réponses 200 et présence des comptes/transactions de test
connus au moment du snapshot. Vérifier aussi leurs montants et relations localement.
Un 401 peut signaler un jeton expiré ; un 403 un rôle manquant. Ne pas les compter
comme un succès de restauration. Ne pas partager les objets contenant les données.

**NAS** : après vérification, supprimer uniquement ce conteneur de test.

```sh
sudo docker rm -f suivi-cb-audit-sqlite-backend
```

Sur le PC, Ctrl+C ferme le tunnel. Les fichiers d’audit sont conservés.

## 2. PostgreSQL : Keycloak distinct sur le dump restauré

Le premier test PostgreSQL du guide supprime son conteneur temporaire à la fin.
Il faut donc restaurer le dump dans une autre pile avant de tester une connexion.
La pile suivante utilise un réseau interne sans accès SMTP/fédération sortant,
une base distincte sans port publié et Keycloak accessible sur la boucle locale
du NAS seulement. Le compte de test doit être un compte local présent dans le dump.

**NAS, SSH** : préparer le dossier.

```sh
sudo mkdir -p /volume1/docker/suivi-cb-audit-keycloak
sudo chown GodOfNasAugerie /volume1/docker/suivi-cb-audit-keycloak
chmod 700 /volume1/docker/suivi-cb-audit-keycloak
```

**PC, PowerShell à la racine du dépôt** : transférer la configuration fournie.

```powershell
scp -O -P 1122 .\docker-compose.audit-keycloak.yml GodOfNasAugerie@192.168.1.113:/volume1/docker/suivi-cb-audit-keycloak/docker-compose.yml
if ($LASTEXITCODE -ne 0) { throw 'Transfert de la pile audit en echec' }
```

**NAS, SSH** : remplacer le chemin du dump. Attendre DUMP_OK et THEMES_OK.
Si le conteneur Keycloak réel porte un autre nom que keycloak, adapter son inspect.

```sh
cd /volume1/docker/suivi-cb-audit-keycloak
PG_DUMP=/volume1/docker/keycloak/backups/audit-restore-YYYUCc/keycloak.dump
sudo test -s "$PG_DUMP" && echo DUMP_OK
PG_AUDIT_IMAGE=$(sudo docker inspect --format '{{.Image}}' keycloak-postgres)
KC_AUDIT_IMAGE=$(sudo docker inspect --format '{{.Image}}' keycloak)
KC_AUDIT_THEMES=/volume1/docker/keycloak/themes
sudo test -d "$KC_AUDIT_THEMES" && echo THEMES_OK
```

Valider puis démarrer la base seulement. Ces variables doivent rester disponibles
dans cette même session SSH. Utiliser une pile neuve ; ne pas réimporter dans une
base d’audit déjà restaurée.

```sh
sudo env PG_AUDIT_IMAGE="$PG_AUDIT_IMAGE" KC_AUDIT_IMAGE="$KC_AUDIT_IMAGE" KC_AUDIT_THEMES="$KC_AUDIT_THEMES" docker compose -p suivi-cb-audit-keycloak -f docker-compose.yml config --quiet
sudo env PG_AUDIT_IMAGE="$PG_AUDIT_IMAGE" KC_AUDIT_IMAGE="$KC_AUDIT_IMAGE" KC_AUDIT_THEMES="$KC_AUDIT_THEMES" docker compose -p suivi-cb-audit-keycloak -f docker-compose.yml up -d --no-build --pull never database
AUDIT_PG=$(sudo docker ps -q --filter label=com.docker.compose.project=suivi-cb-audit-keycloak --filter label=com.docker.compose.service=database)
sudo docker inspect --format '{{.Name}}' "$AUDIT_PG"
sudo docker exec "$AUDIT_PG" pg_isready -U keycloak -d keycloak
```

Le nom doit appartenir à suivi-cb-audit-keycloak et pg_isready doit afficher
accepting connections. Sinon attendre puis relancer le contrôle ; ne pas poursuivre.
Restaurer exclusivement dans cet identifiant AUDIT_PG.

```sh
sudo sh -c 'cat "$1"' sh "$PG_DUMP" | sudo docker exec -i "$AUDIT_PG" pg_restore -U keycloak -d keycloak --exit-on-error --no-owner --no-privileges
```

La commande doit finir sans erreur. Adapter uniquement la copie restaurée pour
accepter HTTP sur localhost, puis démarrer Keycloak. Cette instruction SQL ne
doit jamais être exécutée sur keycloak-postgres réel.

```sh
sudo docker exec "$AUDIT_PG" psql -U keycloak -d keycloak -v ON_ERROR_STOP=1 -c "UPDATE realm SET ssl_required='NONE' WHERE name IN ('master','suivi-cb-preprod');"
sudo env PG_AUDIT_IMAGE="$PG_AUDIT_IMAGE" KC_AUDIT_IMAGE="$KC_AUDIT_IMAGE" KC_AUDIT_THEMES="$KC_AUDIT_THEMES" docker compose -p suivi-cb-audit-keycloak -f docker-compose.yml up -d --no-build --pull never keycloak
sudo env PG_AUDIT_IMAGE="$PG_AUDIT_IMAGE" KC_AUDIT_IMAGE="$KC_AUDIT_IMAGE" KC_AUDIT_THEMES="$KC_AUDIT_THEMES" docker compose -p suivi-cb-audit-keycloak -f docker-compose.yml logs --tail 80 keycloak
```

**PC, PowerShell dédiée** : ouvrir ce tunnel.

```powershell
ssh -N -L 8180:127.0.0.1:8180 -p 1122 GodOfNasAugerie@192.168.1.113
```

**PC, navigateur privé** :

1. Ouvrir http://localhost:8180/realms/suivi-cb-preprod/.well-known/openid-configuration ;
   l’issuer doit commencer par http://localhost:8180.
2. Ouvrir http://localhost:8180/realms/suivi-cb-preprod/account/.
3. Se connecter avec un compte local de test déjà présent lors du dump, avec son
   OTP si configuré. Vérifier le profil attendu puis se déconnecter.
4. Vérifier que les requêtes restent sur localhost:8180. Une redirection vers
   auth.jolurie.com ne valide pas cette restauration ; arrêter et corriger la
   configuration de la copie avant de réessayer.

Une fédération LDAP/IdP externe et SMTP ne fonctionneront pas dans ce réseau isolé.
La connexion locale valide la restauration des comptes et de leurs identifiants.
Les réglages de hostname/HTTP suivent les références
[Keycloak hostname](https://www.keycloak.org/server/hostname) et
[Keycloak containers](https://www.keycloak.org/server/containers).

**NAS, même session** : arrêter uniquement la pile d’audit, sans supprimer le volume.

```sh
cd /volume1/docker/suivi-cb-audit-keycloak
sudo env PG_AUDIT_IMAGE="$PG_AUDIT_IMAGE" KC_AUDIT_IMAGE="$KC_AUDIT_IMAGE" KC_AUDIT_THEMES="$KC_AUDIT_THEMES" docker compose -p suivi-cb-audit-keycloak -f docker-compose.yml down
```

Sur le PC, Ctrl+C ferme le tunnel. Le volume d’audit conserve les données restaurées ;
il reste sensible et doit suivre la politique de conservation des sauvegardes.
Consigner les lectures SQLite et la connexion Keycloak, leurs dates et résultats,
sans données personnelles ni secrets. Ces essais NAS restent à exécuter.
