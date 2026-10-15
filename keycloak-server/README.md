# Serveur Keycloak autonome

Ce dossier est une pile d'identité indépendante. Il peut être copié dans son
propre dépôt ou dans `/volume1/docker/keycloak` sur le NAS, puis utilisé par
plusieurs applications.

## Ce que signifie « indépendant »

Keycloak est indépendant **à l'exécution** : l'application bancaire ne le
contient pas et ne rejoint pas son réseau Docker. Elle utilise seulement son
adresse OIDC publique. Le dossier reste temporairement dans ce dépôt pour
versionner ensemble le thème et la configuration du realm `suivi-cb`.

Pour le NAS, copier uniquement le contenu de ce dossier dans
`/volume1/docker/keycloak`. Il devient alors une installation autonome, qui
pourra héberger les realms et clients d'autres applications.

## Architecture

- `compose.yml` : Keycloak 26.7.4 et PostgreSQL 17 pour la production ;
- `compose.dev.yml` : options locales et import du realm de développement ;
- `themes/` : thèmes disponibles pour tous les realms ;
- `realms/` : configurations initiales propres aux applications ;
- `.env.example` et `.env.dev.example` : modèles sans secret ;
- `archive/` : anciens fichiers conservés mais non utilisés.

PostgreSQL est la base active de Keycloak dans les deux modes. Le volume
Docker `keycloak-postgres-data` conserve les utilisateurs, sessions,
credentials OTP, clients, rôles et paramètres des realms. La base SQLite de
l'application bancaire n'est pas utilisée par Keycloak.

## Production

```sh
cp .env.example .env
# Remplacer les mots de passe dans .env
docker compose --env-file .env -f compose.yml up -d
```

Le reverse proxy expose `https://auth.jolurie.com` et transmet vers
`http://localhost:8080`. Le port 8080 n'est publié que sur la boucle locale du
NAS.

Pour préparer le realm avec les URL de production, depuis ce dossier sur le
poste de développement (Node.js requis) :

```sh
node prepare-production.mjs https://finances.jolurie.com
```

Importer `realms/suivi-cb-prod.json` avec **Create realm** dans la console.
Le fichier conserve les scopes, audiences, PKCE et rôles du modèle de
développement, sans créer d’utilisateur. Il n’écrase jamais un fichier existant.
Le guide complet est dans [KEYCLOAK_NAS.md](../docs/KEYCLOAK_NAS.md) ;
copier aussi ce guide si le dossier est déplacé dans un dépôt indépendant.

## Développement local

Depuis la racine du dépôt :

```powershell
npm start
```

Cette commande lance Keycloak sur `http://localhost:8080`, attend que le realm
soit prêt, puis démarre l'application. La pile `docker-compose.yml` de
l'application est une pile de production et reste configurée pour l'URL HTTPS
publique. Pour démarrer uniquement Keycloak, utiliser `npm run start:keycloak`
depuis la racine du dépôt.

Le realm `suivi-cb` est importé uniquement s’il n’existe pas encore. Un
redémarrage ne remplace jamais un realm déjà créé.

## Accéder à PostgreSQL

PostgreSQL est interne à la pile Keycloak : son port n'est volontairement pas
publié sur Windows ou le réseau. Cela évite d'exposer une base qui contient les
utilisateurs, sessions et credentials. Pour l'administrer localement :

```powershell
cd keycloak-server
docker compose --env-file .env -f compose.yml exec database psql -U keycloak -d keycloak
```

Exemples de commandes dans `psql` :

```sql
\dt
\q
```

Le volume Docker `keycloak-postgres-data` conserve les données lorsque les
conteneurs sont redémarrés. Il ne faut pas le supprimer pour arrêter Keycloak.

## Ajouter une autre application

Créer un realm séparé isole les utilisateurs, rôles, politiques et clients de
chaque application. Une autre application peut aussi partager un realm si les
mêmes comptes doivent être utilisés ; elle doit alors avoir son propre client
OIDC, ses URI de redirection exactes et ses rôles.

La nouvelle application utilise seulement :

```text
https://auth.jolurie.com/realms/<nom-du-realm>
```

Elle n'a pas besoin de rejoindre le réseau Docker de Keycloak.

## Sauvegardes

Une copie brute du volume pendant que PostgreSQL écrit n'est pas une
sauvegarde cohérente. Utiliser `pg_dump` :

```sh
docker compose --env-file .env -f compose.yml exec -T database \
  pg_dump -U keycloak -d keycloak > keycloak-backup.sql
```

Conserver également `compose.yml`, `.env` dans un coffre à secrets, les
thèmes et les éventuels exports de realms.
