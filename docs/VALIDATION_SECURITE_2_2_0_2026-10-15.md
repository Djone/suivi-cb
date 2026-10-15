# Validation de sécurité 2.2.0 — 15 octobre 2026

## Décision actuelle

**La MEP n'est pas encore approuvée.** Les validations locales ci-dessous sont
réussies. La recette des images sur le NAS, les droits GitHub et la maintenance
des sauvegardes restent ouverts. La chaîne quotidienne de sauvegarde est validée
par les résultats NAS fournis par l'utilisateur les 14 et 15 octobre.

Travail effectué sur `2.2.0-dev`, à partir de
`3ec2603d4cde4f5a46a403684623001530f6b71c`, avec modifications locales non commitées.
Les images `2.2.0-security-local` sont des **images d'essai**, pas une release
traçable à un commit propre. Aucun changement NAS, realm partagé ou production
n'a été effectué pendant ces essais.

## Résultats locaux

[Résultats structurés et empreintes des preuves](./audit/2026-10-15/local-security-results.json).

| Contrôle | Résultat et portée |
| --- | --- |
| Backend | 86 tests Jest, 15 tests auth, 18 tests sécurité réussis. Le test auth ajouté lance le véritable `server.js`, une base mémoire et un serveur JWKS synthétique. |
| API | Sans jeton, expiré, mauvaise signature, audience ou realm : 401. Sans rôle : 403. Accès autorisé : 200. Les audiences bancaire et OTP sont vérifiées séparément sur le serveur réel. |
| Keycloak 26.7.4 local | Authorization Code + PKCE S256, enrôlement OTP, OTP invalide refusé puis OTP valide accepté, renouvellement et déconnexion réussis. Le refresh token est refusé après logout. Les deux audiences sont présentes dans le véritable jeton émis par le realm de test. |
| Frontend | Angular 20 et PrimeNG 20.4.0 alignés, thème PrimeUIX 1.2.5. `npm ci` sans contournement des peers, 98 tests et build production réussis. |
| npm production | Backend et frontend : 0 vulnérabilité signalée. |
| npm complet | Backend : 19 modérées ; frontend : 13 élevées, dans les outils de développement. Toujours ouvertes, sans acceptation implicite. Deux alertes modérées frontend supprimées par l'override ciblé de `sockjs > uuid` vers 11.1.1. |
| Images corrigées | Trivy 0.75.0, base de vulnérabilités actualisée le 15 octobre : 0 vulnérabilité et 0 secret détecté dans chaque image. Snapshot des sources suivies et nouveaux fichiers : 0 secret détecté. |
| Exécution Docker | Backend UID 1028/GID 100 ; frontend UID 101/GID 101. Démarrage via commandes normales, toutes capacités retirées et `no-new-privileges`. HTTP frontend 200, API anonyme 401. Aucun port publié pour ce test applicatif. |
| SQLite | Version embarquée 3.52.0. Migrations transactionnelles, ledger `schema_migrations`, empreintes et arrêt sur erreur ; tests d'annulation des changements et de reprise réussis. |
| Rollback | Base créée par l'image 2.1.0 de référence, migration 2.2.0, insertion d'un compte synthétique, retour 2.1.0 puis 2.2.0 : enregistrement conservé, aucune restauration de sauvegarde. |

Les tests Keycloak utilisent un realm et un utilisateur jetables ; aucun jeton,
mot de passe ni secret OTP réel n'est demandé ou enregistré dans les rapports.
La déconnexion invalide le refresh token ; elle ne prouve pas la révocation
immédiate d'un access token JWT déjà émis et vérifié hors ligne.

Le scan d'une image est un constat daté avec les détecteurs de l'outil. Il ne
remplace ni la recette, ni l'examen des composants natifs, ni une garantie
d'absence de vulnérabilité. Les alertes des outils de build ne disparaissent pas
parce qu'ils sont absents des images exécutées.

## Changements livrés dans les sources

- Migrations : orchestration dans `backend/migrations/runner.js`, point d'entrée
  `initializeDatabase.js`, historique isolé dans `legacy-baseline.js`. Les erreurs
  SQL ne sont plus absorbées comme si la colonne existait déjà. Le calcul des
  allocations suit désormais la création de sa table, y compris sur base vide.
- Une migration appliquée n'est plus rejouée à chaque démarrage. Toute nouvelle
  évolution doit ajouter une migration ordonnée ; ne pas modifier les fichiers
  dont l'empreinte a été enregistrée. Une migration inconnue ou une empreinte
  différente bloque le démarrage. L'équivalence CRLF/LF est normalisée.
- PrimeNG : remplacement de Dropdown, Calendar, InputSwitch et TabView par
  Select, DatePicker, ToggleSwitch et Tabs ; nouvel accordéon, gestion des
  références de dialogues éventuellement nulles. Traduction française globale
  conservée. Guide utilisé : https://primeng.org/migration/v20.
- Docker : bases épinglées par digest, correctifs Alpine, retrait de npm et
  Corepack de l'image backend exécutée, utilisateur non privilégié par défaut.
  Nginx écrit son PID dans `/tmp`. Le port interne reste 80 : vérifier aussi
  cette exécution non privilégiée sur le noyau du NAS avant promotion.
- Fins de ligne LF imposées pour scripts, Dockerfiles et configurations.

### Alertes de développement restantes

- `braces <= 3.0.3` : déni de service par motifs imbriqués
  ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)),
  via Karma/webpack/micromatch. Les 13 entrées npm incluent les paquets parents,
  pas 13 failles indépendantes. Pas de version corrigée disponible lors du contrôle.
- `sprintf-js <= 1.1.3` : déni de service par précision non bornée
  ([GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)),
  via Jest/js-yaml/argparse. Même absence de version corrigée lors du contrôle.
- Pas de downgrade automatique Jest/Karma ni de `audit fix --force`. Maintenir
  ces outils dans les postes de développement et runners éphémères, sans secrets
  de production et sans exposition du serveur de développement à un réseau non
  fiable. Une exception éventuelle doit être explicitement approuvée, datée et
  revue à chaque mise à jour amont ; elle n'est pas accordée par ce rapport.
- L'override `sockjs > uuid` conserve l'API CommonJS `v4()` réellement utilisée
  par SockJS. Le lancement Karma avec Chrome et le build sont les contrôles de
  compatibilité ; ne pas généraliser cet override à toutes les dépendances.

## Reproduire les exercices locaux

Docker Desktop doit fonctionner. Les images précédentes de référence restent
inchangées. Les ressources créées par les deux scripts sont jetables et
supprimées à la fin ; aucun chemin de données du NAS n'est accepté.

```powershell
npm.cmd --prefix backend test
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run test:ci
npm.cmd --prefix frontend run build -- --configuration production
docker build -f Dockerfile.backend -t suivi-cb-backend:2.2.0-security-local .
docker build -f Dockerfile.frontend -t suivi-cb-frontend:2.2.0-security-local .
node scripts/test-security-images.cjs suivi-cb-backend:2.2.0-security-local suivi-cb-frontend:2.2.0-security-local suivi-cb-reference-backend:2.1.0-reference.4
node scripts/test-keycloak-flow.cjs quay.io/keycloak/keycloak:26.7.4
```

Preuves locales dans `.cache/security-20261015/` : `image-smoke.json`,
`keycloak-flow.json`, `backend-patched-trivy.json`, `frontend-patched-trivy.json`,
`source-secrets.json`, `source-inventory.json`, audits npm et archives d'images.
Les SBOM CycloneDX `backend.cdx.json` et `frontend.cdx.json` inventorient
respectivement 164 et 72 composants.
Ces caches sont ignorés par Git. Le manifeste d'image Docker Desktop et le
config digest contenu dans l'archive sont distincts ; pour un transfert NAS,
vérifier l'identité avec la procédure d'inventaire OCI existante.

## Recette NAS et livraison : validations encore requises

1. Revoir et commiter ces changements, construire un nouveau candidat depuis le
   commit propre, enregistrer commit, digests, archives, SBOM et résultats de scans.
   Toute correction ultérieure produit un nouveau candidat. Ne pas promouvoir
   les étiquettes locales mutables comme une release finale.
2. Déployer ce candidat en préproduction isolée, sur une copie vérifiée de la
   base courante. Confirmer migrations, UID, droits des volumes, santé, absence
   de publication directe du backend et fonctionnement Nginx non privilégié.
3. Avec le realm NAS `suivi-cb-preprod`, vérifier connexion Angular, retour sur
   `/home`, SSO silencieux, renouvellement, logout et reconnexion ; activer puis
   tester OTP, vérifier son état et sa suppression self-service. Contrôler les
   audiences effectives sans copier le jeton dans un ticket ou un rapport.
4. Confirmer les rejets API et les parcours métier : comptes, catégories,
   transactions, récurrences, épargne, véhicules, salaires et impôts. Pour le
   mauvais realm et le rôle absent, utiliser seulement des comptes de recette.
5. Refaire le rollback avec les digests réellement déployés et une copie des
   données de recette : les écritures nouvelles doivent survivre. Une image
   2.1.0 ne protège pas les API : tout retour à cette version impose le confinement
   LAN existant. Ne jamais restaurer automatiquement une ancienne base.
6. Consigner le rapport d'approbation, puis MEP supervisée avec les mêmes images
   validées, sauvegarde préalable et contrôles après démarrage.

## Sauvegardes : acquis et suite

Validé : `run-20261014T180002Z-CYQ6eQ`, tâche 20 h réussie en 71 secondes,
`SUCCESS`, empreintes vérifiées dans `published`, même run visible dans la
sauvegarde USB Hyper Backup de 21 h 05. Restaurations isolées déjà réussies :
SQLite 123 secondes, PostgreSQL 61 secondes. Ces temps ne prouvent pas une
reconstruction complète du NAS en moins d'une heure.

Restent à préparer et tester sur le NAS :

- Rétention des dossiers sources **et** publiés : simulation préalable, liste
  explicite des runs conservés/supprimables, contrôle des empreintes, rejet des
  liens symboliques et des chemins hors périmètre, protection contre les tâches
  concurrentes. La rotation Hyper Backup ne nettoie pas ces dossiers.
- Alerte de copie externe trop ancienne, fondée sur le dernier **succès Hyper
  Backup**, pas sur la date de modification du répertoire `.hbk`. Obtenir l'état
  de tâche/log sur le NAS avant de choisir le contrôle automatique.
- Exercice périodique de restauration depuis l'USB et exercice complet mesuré
  incluant images, configuration, secrets nécessaires et remise en service.
- Conserver hors NAS la clé/mot de passe Hyper Backup et la procédure de reprise.

## GitHub et droits

Lecture des API GitHub le 15 octobre : dépôt public, branche par défaut `master`,
`master` et `2.2.0-dev` non protégées, aucun ruleset. Aucune protection modifiée.
Le workflow suivi actuellement publie des releases sur tags ; il ne constitue
pas le pipeline de validation ni la chaîne de déploiement demandée.

Avant livraison : protection de la branche cible, PR/revue et contrôles requis,
interdiction des pushes forcés et suppressions, permissions minimales des
workflows, environnements préprod/production et approbation humaine de production.
Implémenter ensuite la CI décrite dans la todolist, avant de rendre ses checks
obligatoires. Vérifier les workflows distants et les droits d'administration
avec le compte habilité ; ne pas considérer les droits non lisibles comme validés.

Sur le NAS, les permissions des sources et sauvegardes vues précédemment restent
des preuves historiques. Vérifier les ACL effectives après installation du
candidat et limiter chaque compte au besoin documenté.
