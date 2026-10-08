# Sécurité : préparation de la MEP 2.2.0

## Dernier audit : 8 octobre 2026

**Package rc1 refusé pour la MEP** : base `app/database.db` embarquée et
correction Nginx SSO absente de l’image frontend. Corrections locales réalisées
et testées ; une nouvelle candidate doit être validée en préproduction.

Voir [le rapport détaillé](./AUDIT_SECURITE_2026-10-08.md) et
[les commandes NAS et restaurations isolées](./AUDIT_SECURITE_NAS.md).
Audits npm production : 0 alerte ; audits complets : frontend 15 (13 élevées,
2 modérées), backend 19 modérées. Les résultats du 7 octobre ci-dessous restent
historiques. HSTS et redirection HTTP manquent dans les contrôles publics actuels.
Les restaurations NAS ne sont pas testées, confirmation utilisateur.


La préproduction a été validée et testée OK par l’utilisateur, confirmation
reçue le **8 octobre 2026**. La date exacte des essais, la référence de la
candidate et les identifiants des images restent à consigner. Les changements
ci-dessous renforcent la couche HTTP ; ils ne constituent pas un audit complet
de sécurité de l’application.

Pour chaque prochaine MEP, la validation de la candidate en préproduction est
obligatoire. La production doit recevoir les **images effectivement testées
en préproduction**, avec sa propre configuration et ses propres données :
voir [la procédure de promotion](./PROMOTION_PREPROD_PRODUCTION.md).

## Corrections dans le dépôt

- Keycloak reste obligatoire pour les API métier, avec validation de signature,
  émetteur, expiration, client et rôle `app-user`. Les routes de release restent
  désactivées en production.
- Le backend ne publie plus le port 3001 sur le NAS. Nginx utilise toujours
  `http://backend:3001` sur le réseau Docker ; le healthcheck reste interne.
  Les accès externes doivent passer par le frontend et `/api`.
- En production, le backend ne fournit plus d’autorisation CORS. L’application
  utilise le proxy `/api` sur sa propre origine. En développement, seules
  `http://localhost:4200` et `http://127.0.0.1:4200` sont autorisées. CORS est
  une règle du navigateur, pas un remplacement de la validation des jetons.
- Les réponses backend utilisent `Cache-Control: no-store`, `nosniff`,
  `X-Frame-Options: DENY` et `Referrer-Policy: no-referrer`. La bannière Express
  est désactivée. Nginx protège aussi le frontend et désactive caméra, micro
  et géolocalisation via Permissions-Policy.
- La limite JSON Express de 100 ko est explicite et Nginx limite également
  les corps de requête. JSON mal formé : 400 ; corps trop grand : 413. Les
  erreurs non traitées renvoient un message générique sans trace interne.
- Les traces de corps de requête et de configuration bancaire ont été retirées
  des contrôleurs et de la validation. Les secrets `.env`, caches, sauvegardes
  et CSV de migration sont exclus du contexte de construction Docker.

## Vérifications réalisées

Résultats fournis par l’utilisateur le **7 octobre 2026**, après correction
des dépendances :

| Contrôle | Résultat |
| --- | --- |
| Backend Jest | 12 suites, 85 tests réussis |
| Authentification et OTP | 11 tests réussis |
| Sécurité HTTP | 5 tests réussis |
| Frontend ChromeHeadless | 73 tests réussis, exécution terminée sans erreur |
| Build Angular de production | Réussi |
| Audit backend `--omit=dev` | 0 vulnérabilité détectée |
| Audit frontend `--omit=dev` | 0 vulnérabilité détectée |
| Audit frontend complet | 11 alertes : 9 élevées, 2 modérées, 0 critique |

Ces résultats valident les contrôles locaux. La validation globale de la
préproduction sur le NAS a depuis été confirmée par l’utilisateur le
8 octobre 2026. Les résultats détaillés des contrôles de sécurité ci-dessous
restent à consigner ; cette confirmation ne vaut pas preuve de restauration,
de validation CSP ou d’acceptation des alertes résiduelles.

## Alertes résiduelles des outils de développement

Le décompte npm inclut les dépendances parentes affectées : 11 alertes ne
signifient pas 11 failles indépendantes. Le rapport fourni contient trois
avis résiduels :

| Dépendance / avis | Gravité | Chaînes concernées | Traitement restant |
| --- | --- | --- | --- |
| [braces — GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Élevée | micromatch, fast-glob, chokidar, Karma, webpack-dev-server, http-proxy-middleware et builder Angular | Aucun correctif publié dans l’avis consulté ; suivre la publication et les mises à jour compatibles |
| [uuid — GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | Modérée | sockjs dans les outils de développement | Mettre à jour la chaîne vers une version corrigée compatible ; ne pas forcer un remplacement de version majeure |
| [webpack-dev-middleware — GHSA-g84c-rxfj-3j2c](https://github.com/advisories/GHSA-g84c-rxfj-3j2c) | Élevée | webpack-dev-server et builder Angular | Version corrigée indiquée par npm : 7.4.5 ou ultérieure ; attendre ou préparer une mise à jour compatible de la chaîne |

L’image finale de `Dockerfile.frontend` contient Nginx et les fichiers Angular
compilés, pas les `node_modules` de construction. Les chaînes citées ne sont
donc pas exécutées comme serveurs Node dans cette image. Elles restent présentes
sur les postes et dans l’étape de build : le risque résiduel concerne ces
environnements. L’audit `--omit=dev` ne remplace pas une analyse du bundle.

Mesures avant décision de MEP :

- Garder les serveurs Angular/Karma locaux et ne pas les exposer sur Internet.
- Construire à partir de sources et de configurations de confiance, avec le
  lockfile mis à jour ; ne pas traiter de motifs glob fournis par des tiers.
- Ne pas utiliser `npm audit fix --force` : les propositions observées
  rétrogradent Karma vers 4 ou passent le builder Angular vers 21.
- Préparer séparément l’alignement PrimeNG/Angular : PrimeNG 19 et Angular 20
  présentent un conflit de peer dependencies ; `--legacy-peer-deps` le contourne.
- Relancer l’audit avant la release et vérifier les versions réellement résolues
  après toute mise à jour.

**Statut : alertes documentées, risque résiduel non clôturé.** Leur maintien
pour la release doit faire l’objet d’une décision explicite du responsable de
la MEP après validation NAS ; cette documentation ne vaut pas acceptation.

## Contrôles de sécurité à consigner ou terminer avant la MEP

La candidate de préproduction est validée globalement. Pour les prochaines
candidates, suivre [PREPRODUCTION_NAS.md](./PREPRODUCTION_NAS.md), puis
[promouvoir les images validées](./PROMOTION_PREPROD_PRODUCTION.md).
Les commandes NAS ci-dessous sont des exemples pour une pile utilisant
`.env.production` ; pour le projet préparé de préproduction, utiliser les
commandes de ce nouveau guide et le domaine `finances-preprod.jolurie.com`.

Depuis le poste de développement :

```powershell
npm --prefix backend run test:security
npm --prefix backend test
npm --prefix frontend run test:ci
npm --prefix frontend run build
npm --prefix backend audit --omit=dev
npm --prefix frontend audit
npm --prefix frontend audit --omit=dev
```

La commande frontend `test:ci` intègre les options directement dans le script
npm pour éviter qu’elles soient interprétées comme des options npm dans
PowerShell. Elle lance ChromeHeadless une seule fois. Une sortie affichant
73 tests réussis suivie de `full page reload` ou `DISCONNECTED` ne valide
pas la suite : la commande doit se terminer sans erreur.

Traiter les vulnérabilités signalées et vérifier la compatibilité des
correctifs avant de modifier les fichiers lock. Ne pas appliquer
`npm audit fix --force` sans examiner les changements de version majeure.

Sur une installation de préproduction, avec ses secrets et ses données de test :

```sh
sudo docker compose --env-file .env.production -f docker-compose.yml config --quiet
sudo docker compose --env-file .env.production -f docker-compose.yml up -d --build
sudo docker compose --env-file .env.production -f docker-compose.yml exec frontend nginx -t
sudo docker compose --env-file .env.production -f docker-compose.yml ps
```

- Vérifier que le reverse proxy HTTPS du NAS pointe sur le frontend (port
  4200) et que le port 3001 n’est plus publié. Adapter toute ancienne sonde
  externe qui appelait directement le backend.
- Vérifier les en-têtes sur les réponses réelles du domaine public, y compris
  les erreurs. Activer HSTS sur le reverse proxy HTTPS après validation du
  certificat ; ne pas se baser sur le protocole HTTP entre conteneurs.
- Tester une API sans jeton (401), avec jeton invalide/expiré (401), sans
  rôle `app-user` (403), puis avec un utilisateur autorisé.
- Tester ajout/modification/suppression des transactions, comptes, salaires
  et opérations récurrentes ; vérifier que les requêtes usuelles restent
  sous la limite de 100 ko.
- Tester connexion, rechargement, renouvellement, déconnexion, changement
  de mot de passe, OTP et récupération par SMTP.
- Vérifier les sauvegardes SQLite et PostgreSQL et tester une restauration
  isolée ; limiter les droits des volumes et des fichiers de secrets.
- Préparer une Content-Security-Policy compatible avec Angular, les styles
  dynamiques et les échanges Keycloak. Commencer en Report-Only en
  préproduction, analyser les violations puis activer la politique validée.
  Une CSP globale Report-Only est désormais préparée dans Nginx ; sa validation
  navigateur et son activation restent à réaliser sur une nouvelle candidate.

La base bancaire est partagée : tous les utilisateurs portant `app-user`
ont accès aux mêmes données. Une séparation par utilisateur nécessiterait
des changements métier et des autorisations sur chaque ressource.

Références : [sécurité Express](https://expressjs.com/en/advanced/best-practice-security/),
[middleware CORS](https://expressjs.com/en/resources/middleware/cors/).

## Procès-verbal de validation NAS

Validation globale : **OK, confirmée par l’utilisateur le 8 octobre 2026**.
Renseigner la date des essais, la version/commit, les identifiants des deux images
et le résultat observé pour chaque ligne. La confirmation globale ne précise
pas quels contrôles spécialisés ont été exécutés. Utiliser une installation
de préproduction avec des données et comptes de test.

« À consigner » signifie que le résultat détaillé manque, pas qu’un échec a
été observé. Les restaurations et la CSP restent à confirmer ou effectuer.

| Contrôle | Résultat attendu | Statut |
| --- | --- | --- |
| Compose et Nginx | Configuration valide, services healthy | À consigner |
| Exposition réseau | Port 3001 non publié ; reverse proxy vers frontend | À consigner |
| En-têtes HTTPS | nosniff, DENY, no-referrer, Permissions-Policy ; HSTS au proxy | Protections de base observées ; HSTS absent |
| API sans jeton / jeton invalide | 401 sans données bancaires | 401 observés le 8 octobre 2026 |
| Utilisateur sans rôle | 403 | À consigner |
| Utilisateur autorisé | Lecture et opérations bancaires autorisées | À consigner |
| Session | Connexion, rechargement, renouvellement et déconnexion | À consigner |
| Mot de passe et SMTP | Modification et récupération par email fonctionnelles | À consigner |
| OTP | Enrôlement, connexion avec code, suppression et récupération | À consigner |
| Données métier | CRUD transactions, comptes, salaires et récurrences sur données de test | À consigner |
| Sauvegarde SQLite | Sauvegarde cohérente et restauration isolée testée | Non testé sur NAS ; à effectuer |
| Sauvegarde PostgreSQL | pg_dump et restauration isolée testés | Non testé sur NAS ; à effectuer |
| CSP | Politique Report-Only analysée puis politique validée | Report-Only préparé localement ; à valider / activer |
| Alertes résiduelles | Décision de traitement/acceptation consignée pour la release | À décider |

### Première vérification sans modification sur le NAS

Depuis le dossier de suivi-cb (adapter les domaines s’ils diffèrent) :

```sh
sudo docker compose --env-file .env.production -f docker-compose.yml config --quiet
sudo docker compose --env-file .env.production -f docker-compose.yml exec frontend nginx -t
sudo docker compose --env-file .env.production -f docker-compose.yml ps
curl -sS -D - -o /dev/null https://finances.jolurie.com/
curl -sS -D - -o /dev/null https://finances.jolurie.com/api/accounts
curl -sS -H "Authorization: Bearer invalid" -D - -o /dev/null https://finances.jolurie.com/api/accounts
curl -fsS https://auth.jolurie.com/realms/suivi-cb/.well-known/openid-configuration
```

Les deux appels `/api/accounts` doivent répondre **401**. Le document OIDC
doit annoncer `https://auth.jolurie.com/realms/suivi-cb` comme émetteur.
Ne pas publier de jeton valide ni les fichiers `.env` dans les résultats.

### Vérifier les sauvegardes

Pour PostgreSQL, suivre [la procédure pg_dump](./KEYCLOAK_NAS.md#4-sauvegarde-et-mise-à-jour).
Restaurer le dump uniquement dans une instance PostgreSQL isolée, puis
vérifier les realms et un compte de test avec une instance Keycloak isolée.

Pour SQLite, utiliser une sauvegarde cohérente via l’API de sauvegarde SQLite
ou, pendant une fenêtre de maintenance, arrêter le backend, sauvegarder tout
le dossier `data/` (y compris les éventuels fichiers WAL/SHM), puis le redémarrer.
Une copie du seul fichier `.db` pendant que l’application écrit ne suffit pas.
Restaurer dans une pile distincte et vérifier les données avec le compte de test.
Consigner le fichier de sauvegarde, la date et le résultat de la restauration.
