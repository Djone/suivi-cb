# Keycloak indépendant sur un NAS Synology

Keycloak peut être installé indépendamment de l'application. Le fichier
`docker-compose.keycloak.production.yml` lance Keycloak et sa base PostgreSQL
dans une pile dédiée. L'application ne dépend que de son URL publique HTTPS.

## 1. Préparer les fichiers sur le NAS

Copier à cet emplacement, par exemple `/volume1/docker/keycloak` :

- `docker-compose.keycloak.production.yml` ;
- le dossier `keycloak/themes/suivi-cb` ;
- une copie de `.env.keycloak.production.example` nommée
  `.env.keycloak.production`.

Remplacer les deux mots de passe d'exemple par deux secrets distincts et
longs. Le mot de passe PostgreSQL ne doit pas être le mot de passe
administrateur Keycloak.

Depuis une session SSH ouverte dans ce dossier :

```sh
docker compose \
  --env-file .env.keycloak.production \
  -f docker-compose.keycloak.production.yml \
  up -d
```

Le port `8080` est publié uniquement sur `127.0.0.1`. Keycloak n'est donc pas
directement exposé sur le réseau ; le reverse proxy Synology est son point
d'entrée.

## 2. Reverse proxy Synology

Dans **Panneau de configuration → Portail de connexion → Avancé → Proxy
inversé**, créer la règle suivante :

| Champ | Valeur |
| --- | --- |
| Source, protocole | `HTTPS` |
| Source, nom d'hôte | `auth.jolurie.com` |
| Source, port | `443` |
| Destination, protocole | `HTTP` |
| Destination, nom d'hôte | `localhost` |
| Destination, port | `8080` |

Affecter à `auth.jolurie.com` un certificat valide dans **Sécurité →
Certificat → Paramètres**. Activer HTTP/2 et HSTS après avoir validé le
fonctionnement HTTPS. Le DNS public `auth.jolurie.com` doit pointer vers le
NAS et le routeur doit transférer le port 443 vers le NAS.

Synology transmet normalement les en-têtes `X-Forwarded-*`. Le Compose fixe
`KC_PROXY_HEADERS=xforwarded`, `KC_HTTP_ENABLED=true` et
`KC_HOSTNAME=https://auth.jolurie.com` pour que les redirections, cookies et
liens envoyés par email utilisent toujours l'adresse publique HTTPS.

Tester ensuite :

```text
https://auth.jolurie.com/realms/master/.well-known/openid-configuration
```

## 3. Realm et application

Importer le realm `suivi-cb`, puis régler le client `suivi-cb-web` avec :

- **Valid redirect URIs** : `https://finances.jolurie.com/home` et
  `https://finances.jolurie.com/silent-check-sso.html` ;
- **Valid post logout redirect URIs** :
  `https://finances.jolurie.com/login` ;
- **Web origins** : `https://finances.jolurie.com` ;
- client public, Authorization Code et PKCE S256 ;
- flux implicite et mot de passe direct désactivés.

Le fichier `keycloak/realm-dev.json` contient des URL `localhost`. Elles
doivent être remplacées dans la console après l'import. Un export du realm
local existant peut aussi être importé sur le NAS afin de conserver les
mappers, rôles et flux déjà configurés.

Sur la pile de l'application, conserver dans `.env.production` :

```dotenv
KEYCLOAK_URL=https://auth.jolurie.com
KEYCLOAK_REALM=suivi-cb
KEYCLOAK_CLIENT_ID=suivi-cb-web
KEYCLOAK_AUDIENCE=suivi-cb-api
```

Le navigateur et le backend utilisent ainsi le même émetteur. Si le backend
du NAS ne parvient pas à résoudre l'URL publique à cause du DNS local ou du
NAT loopback, corriger la résolution DNS locale de `auth.jolurie.com` vers
l'adresse du NAS. Il faut conserver `KEYCLOAK_URL` avec l'URL publique : elle
doit correspondre exactement au claim `iss` des jetons.

## 4. Sauvegarde et mise à jour

Sauvegarder le volume `keycloak-postgres-data` avec une sauvegarde PostgreSQL
cohérente, ainsi que le thème et le fichier Compose. Avant une mise à jour,
faire une sauvegarde puis changer uniquement le tag de l'image Keycloak :

```sh
docker compose --env-file .env.keycloak.production \
  -f docker-compose.keycloak.production.yml pull
docker compose --env-file .env.keycloak.production \
  -f docker-compose.keycloak.production.yml up -d
```

Consulter les journaux avec :

```sh
docker compose --env-file .env.keycloak.production \
  -f docker-compose.keycloak.production.yml logs -f keycloak
```
