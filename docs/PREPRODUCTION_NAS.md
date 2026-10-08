# Monter suivi-cb-preprod dans Container Manager

## Candidate actuelle : préparer rc2

Les étapes d’installation initiale ci-dessous décrivent rc1. Cette archive a
été refusée par l’audit. Pour mettre à jour la préproduction existante, suivre
[CHECKLIST_RC2_PREPRODUCTION.md](./CHECKLIST_RC2_PREPRODUCTION.md) : construire
les images candidates sur le PC, transférer le tar, importer et tester sur le
NAS sans reconstruction, puis promouvoir uniquement les images validées.

La production actuelle est composée de conteneurs individuels. Il n’est pas
nécessaire de les convertir en projet pour créer la préproduction. Créer un
nouveau projet indépendant ; conserver `suivi-cb-frontend` et
`suivi-cb-backend` en fonctionnement.

## Configuration préparée

| Élément | Valeur |
| --- | --- |
| Projet | `suivi-cb-preprod` |
| Dossier NAS | `/volume1/docker/suivi-cb-preprod` |
| Conteneurs | `suivi-cb-preprod-backend`, `suivi-cb-preprod-frontend` |
| Images de cette candidate | `suivi-cb-preprod-backend:2.2.0-rc1`, `suivi-cb-preprod-frontend:2.2.0-rc1` |
| Frontend | `127.0.0.1:4201` → port 80 du conteneur |
| Backend | Port 3001 interne uniquement |
| Base SQLite | `/volume1/docker/suivi-cb-preprod/data/database.db` |
| URL | `https://finances-preprod.jolurie.com` |
| Keycloak | `https://auth.jolurie.com`, realm `suivi-cb-preprod` |

Les réseaux sont propres au projet. La base de production n’est pas montée.
Les identifiants client et audience peuvent rester identiques : les realms
sont distincts et l’API vérifie l’émetteur du realm de préproduction.

## 1. Préparer les fichiers dans File Station

Créer `/volume1/docker/suivi-cb-preprod`, puis y copier depuis le poste local :

- `docker-compose.preprod.yml`, **renommé `docker-compose.yml` sur le NAS** ;
- `.env.preprod.example`, **copié sous le nom `.env.preprod`** ;
- `Dockerfile.backend`, `Dockerfile.frontend`, `nginx.conf`, `.dockerignore` ;
- les dossiers `backend/` et `frontend/` de la nouvelle version, avec leurs
  `package.json` et `package-lock.json` mis à jour.

Ne pas transférer `node_modules`, `dist`, `.angular`, caches, bases `.db`,
données bancaires, logs ou fichiers `.env` locaux. Conserver le nom
`frontend/wait-for.sh`. Le contexte de build est la racine de ce nouveau dossier.

Créer également `data/`, `logs/backend/` et `backups/` dans ce dossier.
Laisser `data/` vide pour que le backend initialise sa propre base.
L’initialisation ajoute les comptes et référentiels prévus dans le code ;
vérifier leurs paramètres et saisir des transactions fictives pour les tests.
Ne pas copier la base de production.

Le fichier `.env.preprod` contient :

```dotenv
KEYCLOAK_URL=https://auth.jolurie.com
KEYCLOAK_REALM=suivi-cb-preprod
KEYCLOAK_CLIENT_ID=suivi-cb-web
KEYCLOAK_AUDIENCE=suivi-cb-api
```

Ce Compose charge explicitement `.env.preprod` avec `env_file` : pas besoin
de paramétrer `--env-file` dans l’interface DSM. `NODE_ENV=production` est
imposé pour tester les protections de production.

Les images doivent être construites à partir de la nouvelle version du code. Le Compose fourni contient déjà les instructions build et les noms des images.

En SSH, depuis le dossier de préproduction :
`cd /volume1/docker/suivi-cb-preprod`
`sudo docker compose -p suivi-cb-preprod -f docker-compose.yml build`
`sudo docker compose -p suivi-cb-preprod -f docker-compose.yml up -d`

## 2. Préparer Keycloak

1. Ouvrir `https://auth.jolurie.com/admin/`.
2. Utiliser **Create realm → Browse**, sélectionner le fichier local
   `keycloak-server/realms/suivi-cb-preprod.json`, puis créer le realm.
3. Vérifier que le realm sélectionné est **suivi-cb-preprod**.
4. Créer un utilisateur de test, définir son mot de passe et lui attribuer
   le rôle de realm `app-user`. Créer aussi un compte de test sans ce rôle
   pour vérifier les refus 403.
5. Configurer le [SMTP du realm](./KEYCLOAK.md#configuration-smtp-envoi-des-emails)
   avec une boîte de test que vous contrôlez.

Le realm contient les retours `/home`, `/silent-check-sso.html` et `/login`
sur `finances-preprod.jolurie.com`, les scopes `basic`/`acr` et les audiences
API/Account. Il ne crée aucun compte. Le thème `suivi-cb` doit être présent
sur le serveur Keycloak existant. Si le realm existe déjà, modifier sa
configuration dans la console plutôt que le supprimer.

## 3. Créer le projet dans Container Manager

1. Ouvrir **Container Manager → Projet → Créer**.
2. Nom : **suivi-cb-preprod**.
3. Chemin : sélectionner le nouveau dossier `/docker/suivi-cb-preprod`
   (chemin système `/volume1/docker/suivi-cb-preprod`).
4. Choisir le fichier `docker-compose.yml` préparé : utiliser le fichier
   existant ou l’option de chargement proposée par la version DSM.
5. Si DSM propose un portail Web Station, ne pas l’activer pour cette
   installation : le reverse proxy DSM sera configuré à l’étape suivante.
6. Vérifier les noms préproduction et le seul port publié `127.0.0.1:4201:80`.
7. Terminer et lancer la construction/démarrage du projet. Surveiller les
   journaux de build puis l’état des deux nouveaux conteneurs.

Les images sont construites à partir des fichiers copiés : le NAS doit pouvoir
joindre les registres Docker, npm et les ressources utilisées par le build.
La durée et les ressources nécessaires dépendent du NAS.

Résultat attendu : quatre conteneurs applicatifs visibles, les deux existants
et les deux nouveaux `suivi-cb-preprod-*`, ces derniers devenant **healthy**.
Dans **Projet**, `suivi-cb-preprod` apparaît désormais comme une pile gérée.

## 4. DNS, certificat et reverse proxy

Ajouter le DNS `finances-preprod.jolurie.com` vers le même point d’entrée que
la production et obtenir/affecter un certificat valide couvrant ce nom.
Si le port HTTPS 443 est déjà redirigé vers le NAS, conserver cette redirection.

Dans **Panneau de configuration → Portail de connexion → Avancé → Proxy inversé**,
ajouter une règle distincte :

| Champ | Valeur |
| --- | --- |
| Source | HTTPS, `finances-preprod.jolurie.com`, port `443` |
| Destination | HTTP, `127.0.0.1`, port `4201` |

Affecter le certificat à cette règle dans **Sécurité → Certificat → Paramètres**.
Le port 4201 est limité à la boucle locale : l’accès attendu est via HTTPS,
pas via `http://IP_NAS:4201`. Le reverse proxy de production reste sur sa
destination actuelle.

## 5. Premiers contrôles

Dans une session SSH ouverte dans le nouveau dossier :

```sh
cd /volume1/docker/suivi-cb-preprod
sudo docker compose -p suivi-cb-preprod -f docker-compose.yml config --quiet
sudo docker compose -p suivi-cb-preprod -f docker-compose.yml ps
sudo docker compose -p suivi-cb-preprod -f docker-compose.yml exec frontend nginx -t
curl -fsS https://finances-preprod.jolurie.com/api/auth/config
curl -sS -D - -o /dev/null https://finances-preprod.jolurie.com/api/accounts
```

La configuration publique doit afficher `realm: suivi-cb-preprod`. L’appel
sans jeton à `/api/accounts` doit répondre **401**. Le backend ne doit pas
afficher de mappage `0.0.0.0:3001`.

Ouvrir ensuite le domaine de préproduction et tester la connexion avec le
compte dédié. Poursuivre les parcours métier, OTP, SMTP et restauration
décrits dans [SECURITE_MEP.md](./SECURITE_MEP.md). Adapter tous les domaines
et commandes de ce guide à la préproduction, avec ce dossier et ce Compose.

## Mise à jour et promotion

À chaque nouvelle candidate, choisir un nouveau tag d’image dans le Compose
(par exemple `2.2.0-rc2`), copier les sources et lockfiles correspondants, puis
reconstruire le projet de préproduction. Conserver ses dossiers `data` et `backups`.
Un simple redémarrage ne reconstruit pas les images.

Avant la MEP, relever les identifiants des images testées. La promotion devra
réutiliser ces images avec les variables et volumes de production : ne pas
reconstruire une autre candidate ni importer les comptes ou données de test
en production. La validation globale a été confirmée par l’utilisateur le 8 octobre 2026.
Pour chaque MEP, suivre désormais [PROMOTION_PREPROD_PRODUCTION.md](./PROMOTION_PREPROD_PRODUCTION.md) :
consigner la candidate et les images, valider les contrôles de sécurité, puis
promouvoir les images exactes sans reconstruction en production.

Référence : [projets Container Manager — Synology](https://kb.synology.com/en-global/DSM/help/ContainerManager/docker_project).

## Page blanche et erreur X-Frame-Options

Le SSO silencieux de Keycloak utilise une iframe. Seule la page exacte
`/silent-check-sso.html` doit accepter une iframe de la même origine :
le Nginx du dépôt utilise `SAMEORIGIN` et `frame-ancestors 'self'` sur cette
page, et conserve `DENY` sur les autres pages. Le fichier doit répondre 200,
sans redirection vers `/` ni vers une page Angular. Vérifier également que
le reverse proxy DSM ne rajoute pas `DENY` sur cette réponse.

Pour appliquer uniquement la configuration corrigée sans reconstruire les images,
copier `nginx.conf` dans le dossier de préproduction du NAS puis :

```sh
sudo docker cp nginx.conf suivi-cb-preprod-frontend:/etc/nginx/nginx.conf
sudo docker compose -p suivi-cb-preprod -f docker-compose.yml exec frontend nginx -t
sudo docker compose -p suivi-cb-preprod -f docker-compose.yml exec frontend nginx -s reload
curl -sS -D - -o /dev/null https://finances-preprod.jolurie.com/silent-check-sso.html
```

La réponse doit contenir `X-Frame-Options: SAMEORIGIN`, sans autre en-tête
X-Frame-Options contradictoire. Cette copie est temporaire jusqu’à la prochaine
recréation du conteneur : reconstruire/exporter l’image frontend avec le
Nginx corrigé avant de valider définitivement la candidate.

Référence : [SSO silencieux Keycloak](https://www.keycloak.org/securing-apps/javascript-adapter).
