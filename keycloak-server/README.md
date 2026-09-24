# Serveur Keycloak autonome

Ce dossier est une pile d'identité indépendante. Il peut être copié dans son
propre dépôt ou dans `/volume1/docker/keycloak` sur le NAS, puis utilisé par
plusieurs applications.

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

## Développement local

```powershell
cd keycloak-server
Copy-Item .env.dev.example .env
# Remplacer les mots de passe dans .env
docker compose --env-file .env -f compose.yml -f compose.dev.yml up -d
```

Le realm `suivi-cb` est importé uniquement si la base PostgreSQL est vide. Un
redémarrage ne remplace jamais un realm déjà créé.

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
