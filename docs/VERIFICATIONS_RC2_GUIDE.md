# Vérifications pratiques de la rc2

Après installation de rc2, suivre ce guide dans l’ordre. Chaque section indique
le poste utilisé et le résultat attendu. Noter la date et les identifiants des
images testées. Aucun test ci-dessous ne constitue une MEP.

## 1. DSM : HSTS et redirection HTTP vers HTTPS

**Sur le PC, navigateur DSM** :

1. Ouvrir Panneau de configuration → Portail de connexion → Avancé → Proxy inversé.
2. Modifier la règle HTTPS / finances-preprod.jolurie.com / 443.
3. Conserver sa destination HTTP / 127.0.0.1 / 4201.
4. Cocher Activer HSTS, puis enregistrer. Les intitulés varient selon DSM.
5. Dans Sécurité → Certificat → Paramètres, vérifier le certificat affecté à ce domaine.
6. Ouvrir le domaine HTTPS : aucun avertissement de certificat ne doit apparaître.

**Sur le PC, PowerShell** :

~~~powershell
curl.exe --max-time 15 -sS -D - -o NUL https://finances-preprod.jolurie.com/
curl.exe --max-time 15 -sS -D - -o NUL https://finances-preprod.jolurie.com/api/accounts
curl.exe --max-time 15 -sS -D - -o NUL http://finances-preprod.jolurie.com/home
~~~

- [ ] HTTPS : Strict-Transport-Security présent avec max-age > 0.
- [ ] API sans jeton : 401, avec les protections HTTPS.
- [ ] HTTP : 301 ou 308 et Location: https://finances-preprod.jolurie.com/home.

Ne pas ajouter -k ou -L : ils masqueraient respectivement un problème de certificat
ou la réponse initiale. Employer curl.exe plutôt que l’alias PowerShell curl.
HSTS indique au navigateur de préférer HTTPS après réception de l’en-tête ;
il n’installe pas une redirection HTTP sur le serveur.
[Référence HSTS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security).

### Si le domaine HTTP répond encore 200

Ne pas changer la règle HTTPS fonctionnelle. Créer une redirection dédiée,
puis une règle DSM pour la source HTTP / finances-preprod.jolurie.com / 80.
Voici une solution concrète si DSM ne propose pas de véritable redirection 301/308.

**NAS, SSH**, garder la même session pour FRONTEND_IMAGE :

~~~sh
mkdir -p /volume1/docker/suivi-cb-preprod/http-redirect
cat > /volume1/docker/suivi-cb-preprod/http-redirect/nginx.conf <<'NGINX'
events {}
http {
  server {
    listen 80;
    server_name finances-preprod.jolurie.com;
    location / { return 308 https://finances-preprod.jolurie.com$request_uri; }
  }
}
NGINX
FRONTEND_IMAGE=$(sudo docker inspect --format '{{.Image}}' suivi-cb-preprod-frontend)
sudo docker run --rm --entrypoint nginx \
  --mount type=bind,source=/volume1/docker/suivi-cb-preprod/http-redirect/nginx.conf,target=/etc/nginx/nginx.conf,readonly \
  "$FRONTEND_IMAGE" -t
~~~

Après succès de nginx -t et vérification que le port 4202 n’est pas utilisé :

~~~sh
sudo docker run -d --name suivi-cb-preprod-http-redirect --restart unless-stopped \
  -p 127.0.0.1:4202:80 \
  --mount type=bind,source=/volume1/docker/suivi-cb-preprod/http-redirect/nginx.conf,target=/etc/nginx/nginx.conf,readonly \
  --entrypoint nginx "$FRONTEND_IMAGE" -g 'daemon off;'
curl -sS -D - -o /dev/null http://127.0.0.1:4202/home
~~~

Attendu : 308 et Location HTTPS. **Dans DSM**, router la source
HTTP / finances-preprod.jolurie.com / 80 vers HTTP / 127.0.0.1 / 4202.
Modifier une règle HTTP existante plutôt que créer deux règles de même source.
Le conteneur ne doit pas être publié directement sur le port 80 du NAS.
Si un portail Web Station utilise la même source et DSM refuse la règle,
identifier ce conflit avant de modifier le portail. Refaire ensuite curl.exe
sur le domaine public. Ce service de redirection ne modifie pas les images rc2.

## 2. Parcours applicatifs : navigateur PC sur la préproduction

Utiliser exclusivement des comptes et données fictifs. Ouvrir F12 → Réseau
(Network), cocher Conserver le journal (Preserve log), filtrer sur /api/.
Ne pas exporter un HAR brut : il peut contenir jetons et données.

| Contrôle | Manipulation | Attendu |
| --- | --- | --- |
| Connexion | Fenêtre privée, connexion avec le compte de test app-user | Application accessible ; API métier 200 |
| Rechargement | F5 sur une page contenant des données | Session conservée et données visibles |
| Renouvellement | Attendre au-delà de la durée du jeton d’accès Keycloak, puis refaire une lecture | Renouvellement réussi si la session SSO est toujours valide |
| Déconnexion | Déconnecter puis recharger une page métier | Connexion requise ; aucune nouvelle lecture bancaire autorisée |
| Comptes | Créer/modifier un compte fictif et recharger | Données cohérentes et persistantes |
| Transactions | Ajouter/modifier/supprimer une transaction fictive | Liste et soldes cohérents après F5 |
| Récurrences | Créer/modifier une récurrence et vérifier son occurrence | Résultat attendu, aucune erreur API inattendue |
| Salaires | Modifier une valeur fictive puis recharger | Valeur conservée et calculs cohérents |
| Mot de passe | Modifier celui du compte de test puis se reconnecter | Nouvelle authentification réussie |
| SMTP | Mot de passe oublié vers une boîte de test contrôlée | Email reçu et récupération fonctionnelle ; lien auth.jolurie.com |
| OTP | Enrôler, déconnecter et reconnecter | Mauvais code refusé, bon code accepté |
| Suppression OTP | Désactiver puis reconnecter | État cohérent ; noter la réauthentification demandée pour cette action sensible |

La durée de jeton est visible dans Keycloak → Realm settings → Tokens ; la durée
de session est distincte (Sessions). Si la suppression OTP ne demande pas la
réauthentification attendue, consigner le comportement comme point à examiner.
La présence du claim acr seule ne prouve pas un facteur OTP.

### Tester le refus 403

1. Dans l’administration Keycloak, choisir le realm suivi-cb-preprod.
2. Utiliser un second compte local de test sans le rôle app-user. Vérifier les
   rôles effectifs : un groupe ou un rôle composite peut l’attribuer.
3. Ouvrir une autre fenêtre privée et se connecter avec ce compte.
4. Dans F12 → Network, sélectionner une requête métier /api/accounts.
5. Attendu : **403**, sans données bancaires. Un 401 ne prouve pas le contrôle
   du rôle : il indique plutôt un jeton/session invalide.
6. Refaire avec le compte app-user : la même API doit répondre 200.

## 3. CSP : console du navigateur PC

1. Ouvrir F12 avant de charger la page. Dans Network, cocher Disable cache.
2. Recharger et sélectionner le document HTML principal → Headers.
3. Vérifier Content-Security-Policy-Report-Only dans les en-têtes de réponse.
4. Dans Console, afficher tous les niveaux ; chercher CSP, Content Security
   Policy, Refused ou report-only.
5. Effacer les anciens messages, puis réaliser tous les parcours du tableau,
   ainsi que graphiques, polices/icônes, modales, F5 et SSO silencieux.
6. Pour chaque violation, noter page/action, directive (script-src, style-src,
   connect-src, frame-src…), URL de ressource et message nettoyé des secrets.

Report-Only signale ce qui serait bloqué après activation. Une application qui
fonctionne peut donc avoir une politique incompatible. Refaire les essais en
fenêtre privée sans extensions pour distinguer leurs messages de ceux de l’application.
La page silent-check-sso.html a aussi une politique appliquée frame-ancestors self.

- [ ] Tous les parcours examinés ; aucune violation applicative inexpliquée.
- [ ] Violations corrigées de façon ciblée, sans wildcard ou unsafe-eval par facilité.
- [ ] Politique appliquée dans une nouvelle candidate rc3, puis tests refaits.

Transmettre les messages CSP nettoyés pour préparer cette correction. Ne pas
activer la politique globale avant l’analyse ; rc2 en observation ne clôture pas ce point.

## 4. Restaurations : contrôles applicatifs sur des copies

Suivre [RESTAURATIONS_APPLICATIVES_ISOLEES.md](./RESTAURATIONS_APPLICATIVES_ISOLEES.md).
Ce guide fournit les commandes NAS, les tunnels SSH depuis le PC, les URL et
les lectures à vérifier. Les services de test sont distincts ; les données
actives de préproduction/production ne sont pas remplacées.

- [ ] SQLite : le script d’intégrité réussit ET un backend distinct lit la base restaurée.
- [ ] PostgreSQL : pg_restore réussit ET une instance Keycloak isolée permet
  de se connecter avec un compte local de test présent au moment du dump.

Le premier test PostgreSQL supprime son conteneur temporaire à la fin : il faut
une autre restauration dans la pile dédiée avant l’essai Keycloak. Aucune
confirmation de réussite n’est déduite des commandes seules.

## 5. Scan des images : Docker Desktop sur le PC

Scanner les images réellement utilisées sur le NAS. Si les images rc2 locales
correspondent exactement aux images importées et exécutées, utiliser leurs tags.
Sinon, récupérer le tar exporté du NAS et le charger avec docker load avant le scan.
Une modification manuelle dans un conteneur n’est pas couverte par le scan de son image.

Se connecter au compte Docker dans Docker Desktop : Scout nécessite ici une
connexion au service et lui transmet l’inventaire des composants.
**PowerShell sur le PC**, racine du dépôt :

~~~powershell
$ScanDir = Join-Path (Get-Location).Path '.cache/releases/2.2.0-rc2/scans'
New-Item -ItemType Directory -Force -Path $ScanDir | Out-Null
docker image inspect suivi-cb-preprod-backend:2.2.0-rc2 suivi-cb-preprod-frontend:2.2.0-rc2 --format '{{.Id}} {{json .RepoTags}}'
docker scout cves --format sarif --output (Join-Path $ScanDir 'backend.sarif.json') local://suivi-cb-preprod-backend:2.2.0-rc2
if ($LASTEXITCODE -ne 0) { throw "Scan backend non termine" }
docker scout cves --format sarif --output (Join-Path $ScanDir 'frontend.sarif.json') local://suivi-cb-preprod-frontend:2.2.0-rc2
if ($LASTEXITCODE -ne 0) { throw "Scan frontend non termine" }
docker scout cves --only-severity critical,high local://suivi-cb-preprod-backend:2.2.0-rc2
docker scout cves --only-severity critical,high local://suivi-cb-preprod-frontend:2.2.0-rc2
npm --prefix backend audit
npm --prefix frontend audit
~~~

Adapter les tags à la candidate finale si rc3. Un scan refusé/non terminé ou un
rapport absent ne vaut pas zéro vulnérabilité. Le code de sortie Scout sans
option exit-code ne prouve pas l’absence de CVE : lire les rapports. Les audits
npm complets peuvent renvoyer un code non nul avec les alertes de développement.

Pour chaque alerte, noter composant/version, gravité, version corrigée, présence
dans l’image finale et exposition. Corriger les critiques/élevées applicables,
ou consigner une décision explicite motivée avec mesures compensatoires et échéance.
Ne pas accepter automatiquement le risque et ne pas utiliser npm audit fix --force.
Toute correction intégrée à l’image exige une nouvelle candidate et des tests.
[Référence Docker Scout](https://docs.docker.com/reference/cli/docker/scout/cves/).

## Compte rendu à conserver

~~~text
Date, candidate et identifiants des deux images :
HSTS : présent/absent ; max-age :
HTTP : code et Location :
Parcours métier/session/SMTP/OTP : résultats ou échecs :
Compte sans app-user : statut API :
CSP : messages applicatifs nettoyés ou absence de violation :
SQLite : rapport d’intégrité + lecture API restaurée :
PostgreSQL : restauration + connexion Keycloak isolée :
Scans : rapports, critiques/élevées et traitement :
~~~

Ne transmettre ni jetons, ni dumps, ni secrets. Les cases restent ouvertes
jusqu’à observation des résultats. Les procédures n’ont pas été exécutées sur le NAS
lors de la rédaction de ce guide.
