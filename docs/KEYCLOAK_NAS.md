# Keycloak indépendant sur un NAS Synology

Keycloak peut être installé indépendamment de l'application. Le fichier
`keycloak-server/compose.yml` lance Keycloak et sa base PostgreSQL
dans une pile dédiée. L'application ne dépend que de son URL publique HTTPS.

## 1. Préparer les fichiers sur le NAS

Copier à cet emplacement, par exemple `/volume1/docker/keycloak` :

- `compose.yml`, `.env.example` et les dossiers `themes/` et `realms/` de
  `keycloak-server` (ne pas copier le `.env` local, `archive/` ou
  `compose.dev.yml`) ;
- une copie de `.env.example` nommée `.env`.

Remplacer les deux mots de passe d'exemple par deux secrets distincts et
longs. Restreindre les droits du fichier `.env` au compte qui administre la
pile (`chmod 600 .env` en SSH). Le mot de passe PostgreSQL ne doit pas être le mot de passe
administrateur Keycloak.

Depuis une session SSH ouverte dans ce dossier :

```sh
sudo docker compose --env-file .env -f compose.yml up -d
```

Le port `8080` est publié uniquement sur `127.0.0.1`. Keycloak n'est donc pas
directement exposé sur le réseau ; le reverse proxy Synology est son point
d'entrée.

## 2. Reverse proxy Synology

Dans **Panneau de configuration → Portail de connexion → Avancé → Proxy
inversé**, créer la règle suivante :

| Champ                   | Valeur             |
| ----------------------- | ------------------ |
| Source, protocole       | `HTTPS`            |
| Source, nom d'hôte      | `auth.jolurie.com` |
| Source, port            | `443`              |
| Destination, protocole  | `HTTP`             |
| Destination, nom d'hôte | `localhost`        |
| Destination, port       | `8080`             |

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

Sur le poste de développement, depuis la racine du dépôt :

```powershell
node keycloak-server/prepare-production.mjs https://finances.jolurie.com
```

La commande crée `keycloak-server/realms/suivi-cb-prod.json`. Elle conserve
les scopes `basic` et `acr`, les audiences API et Account, les rôles et les
paramètres de sécurité du modèle, et remplace les URI locales. Si ce fichier
existe déjà, fournir un autre chemin de sortie en deuxième argument.
Node.js est nécessaire seulement sur le poste qui prépare le fichier.

Ouvrir `https://auth.jolurie.com/admin/`, puis **Create realm → Browse** et
sélectionner ce fichier, puis **Create**. Ne pas l’importer dans `master`.
Si le realm `suivi-cb` existe déjà, modifier son client dans la console ;
ne pas le supprimer pour appliquer ces URL.

Vérifier le client `suivi-cb-web` :

- **Valid redirect URIs** : `https://finances.jolurie.com/home` et
  `https://finances.jolurie.com/silent-check-sso.html` ;
- **Valid post logout redirect URIs** :
  `https://finances.jolurie.com/login` ;
- **Web origins** : `https://finances.jolurie.com` ;
- client public, Authorization Code et PKCE S256 ;
- flux implicite et mot de passe direct désactivés.

Le fichier de production ne crée aucun utilisateur et ne migre pas les
comptes locaux. Créer un utilisateur, définir son mot de passe, puis lui
attribuer le rôle de realm `app-user` uniquement s’il doit accéder à tous
les comptes bancaires. Configurer le SMTP dans **suivi-cb → Realm settings → Email** en suivant
[la procédure SMTP et ses tests](./KEYCLOAK.md#configuration-smtp-envoi-des-emails)
pour rendre la récupération du mot de passe opérationnelle. Les détails OTP et les rôles Account sont dans [KEYCLOAK.md](./KEYCLOAK.md).

Créer ensuite un administrateur nominatif permanent dans `master`, lui
attribuer les droits administrateur nécessaires et configurer son OTP.
Valider sa connexion avant de supprimer le compte temporaire de bootstrap,
puis retirer les variables `KC_BOOTSTRAP_ADMIN_*` du Compose de cette
installation et du `.env`. Ces variables ne changent pas le mot de passe
d’un compte déjà créé.

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

Démarrer ou recréer la pile suivi-cb en chargeant explicitement ce fichier :

```sh
docker compose --env-file .env.production -f docker-compose.yml up -d
```

Cette commande s’exécute dans le dossier de suivi-cb, distinct du dossier
Keycloak. Ne pas utiliser `start-keycloak-dev.bat` sur le NAS : il lance
le mode développement.

### Vérifier avant d’utiliser les données réelles

- La découverte OIDC de `suivi-cb` répond en HTTPS et son champ `issuer`
  vaut exactement `https://auth.jolurie.com/realms/suivi-cb`.
- `/api/auth/config` sur le domaine suivi-cb annonce cette URL et le client
  `suivi-cb-web`.
- La connexion, le rechargement, la déconnexion et la récupération par email
  fonctionnent ; un utilisateur sans `app-user` reçoit un refus API.
- Si l’OTP est utilisé, vérifier son activation, la connexion avec code et
  sa désactivation depuis suivi-cb.

## 4. Sauvegarde et mise à jour

Depuis le dossier Keycloak sur le NAS, produire une sauvegarde PostgreSQL
cohérente :

```sh
mkdir -p backups
chmod 700 backups
umask 077
docker compose --env-file .env -f compose.yml exec -T database \
  pg_dump -U keycloak -d keycloak > backups/keycloak-$(date +%Y%m%d-%H%M%S).sql
```

Vérifier que la commande réussit, conserver une copie protégée hors du NAS
et tester sa restauration dans une pile isolée avant la première mise à
jour. Conserver également les thèmes, le Compose et les secrets dans un
coffre. Un export de realm seul ne remplace pas cette sauvegarde. Ne jamais
utiliser `docker compose down -v` pour arrêter la pile : cela efface la base.

Avant une mise à jour,
faire une sauvegarde puis changer uniquement le tag de l'image Keycloak :

```sh
docker compose --env-file .env -f compose.yml pull
docker compose --env-file .env -f compose.yml up -d
```

Consulter les journaux avec :

```sh
docker compose --env-file .env -f compose.yml logs -f keycloak
```

## 5. Ajouter d’autres applications

La même instance Keycloak et sa base peuvent servir plusieurs applications.
Chaque application reçoit son propre client OIDC et ses URI HTTPS exactes.
Partager le realm pour partager les comptes et la session SSO ; créer un
realm distinct pour isoler les comptes et les politiques. Les droits
`app-user` de suivi-cb ne doivent pas devenir des droits par défaut pour les
autres applications. Pour une nouvelle application, préférer des rôles
propres à son client et une audience propre à son API.

Les nouvelles applications utilisent seulement l’URL OIDC publique ; elles
ne rejoignent pas le réseau Docker de Keycloak. Cette installation à une
instance reste simple, mais une panne du NAS touche l’authentification de
toutes les applications.

Références : [conteneurs](https://www.keycloak.org/server/containers),
[reverse proxy](https://www.keycloak.org/server/reverseproxy),
[import et export](https://www.keycloak.org/server/importExport),
[administrateur de bootstrap](https://www.keycloak.org/server/bootstrap-admin-recovery).
