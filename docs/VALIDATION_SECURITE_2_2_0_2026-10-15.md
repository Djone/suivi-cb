# Validation de sécurité 2.2.0 — 15 octobre 2026

> Suivi ultérieur des dépendances : [correction et risque restant](./DEPENDANCES_OUTILS_2026-10-15.md).
> Les comptes d'alertes et preuves ci-dessous décrivent la validation initiale.
> Le risque résiduel `braces` des outils de test a été accepté explicitement
> le 15 octobre, avec revue prévue au plus tard le 22 octobre ; voir ce suivi.

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

## Compl?ment de recette NAS RC7 ? 15 octobre 2026

R?sultats communiqu?s par l?utilisateur : deux conteneurs running/healthy sans OOM, frontend HTTP 200, API anonyme HTTP 401, version affich?e 2.2.0-rc.7. Connexion avec utilisateur autoris?, acc?s aux comptes et op?rations, d?connexion et OTP d?clar?s valid?s. Maintien de l?acc?s apr?s plus de dix minutes observ? ; un renouvellement effectif du jeton reste ? attester par une r?ponse de renouvellement r?ussie ou une ?volution de son expiration.

Le compte de recette djonedjone-pp-userappless se connecte ? Keycloak, mais les API comptes, transactions, sous-cat?gories et autres ressources retournent 403 : refus c?t? backend valid?. L?interface affiche n?anmoins un tableau de bord vide avec des erreurs console. Correction ? r?aliser avant MEP : ?cran Acc?s non autoris?, gestion centralis?e du 403, suppression des chargements m?tier inutiles et d?connexion accessible. L?authentification Keycloak ne suffit pas ? autoriser les donn?es.

Restent les audiences effectives du jeton NAS, la preuve du renouvellement, la recette m?tier ?tendue et le rollback sur copie NAS ; r?tention/surveillance, droits GitHub/NAS, puis approbation et MEP supervis?e. Toute correction embarqu?e dans une image impose une nouvelle candidate et une nouvelle qualification ; RC7 n?est pas approuv?e pour la production.

## Correction de l’interface après refus d’accès

Implémentation locale : le garde de navigation vérifie le rôle de realm `app-user` avant de créer le layout métier. Un utilisateur sans rôle est redirigé vers `/access-denied`, hors du layout, avec un message explicite et une déconnexion accessible. Le chargement initial du statut OTP est évité sans ce rôle. Un HTTP 403 reçu via l’intercepteur API déclenche le même écran et bloque les nouveaux appels API ; un 401 conserve son traitement de fin de session. Les requêtes déjà envoyées ne sont pas annulées. Le backend reste responsable de l’autorisation effective.

Validation locale : 102 tests frontend réussis, dont refus du garde, traitement du 403, absence de nouvel appel après refus et bouton de déconnexion. La recette NAS de cette correction reste à faire dans une nouvelle candidate ; RC7 reste inchangée.

## Preuve des audiences et du renouvellement NAS RC7

Le 15 octobre 2026, l’utilisateur confirme : issuer https://auth.jolurie.com/realms/suivi-cb-preprod, client (azp) suivi-cb-web, audiences account et suivi-cb-api. Premier jeton : iat 2026-10-15T11:47:03Z, exp 2026-10-15T11:52:03Z. Deuxième jeton : iat 2026-10-15T11:52:02Z, exp 2026-10-15T11:57:02Z. La requête ayant produit le second jeton porte grant_type=refresh_token et retourne HTTP 200 ; les API comptes/opérations répondent ensuite HTTP 200. Audience et renouvellement technique validés pour la préproduction RC7 ; aucun jeton brut conservé. Ce résultat complète les observations précédentes et lève leur réserve sur ces deux points, sans approbation de MEP.

## Ordre des travaux demandé

L’utilisateur demande de ne pas engager le dernier point « Approbation puis MEP supervisée ». Terminer d’abord la sécurisation : qualification de la nouvelle candidate et recette NAS, contrôles de rétention/surveillance/reprise, protections GitHub et droits NAS. Après cette sécurisation effective, traiter l’automatisation de la clôture de release depuis `/release-process`, en reprenant les preuves et contrôles réalisés. Ce chantier est inscrit dans la todo-list 2.3.0, avec les tests automatisés ; aucune approbation de production ni publication n’en découle.

## Recette métier manuelle NAS RC7

L’utilisateur confirme les sept parcours réussis : création, modification, virement, récurrence, rapprochement, suppression et persistance. Aucune erreur API signalée. Ces résultats déclaratifs valident la recette métier manuelle de RC7 ; les parcours concernés restent à revalider sur la candidate finale contenant la correction de l’accès refusé.

La pile d’appels transmise provenait du journal de l’onglet Réseau et illustrait les requêtes réussies, comme précisé ensuite par l’utilisateur. La capture fournie montre des réponses HTTP 200 sur les requêtes visibles : comptes, transactions, récurrences, exceptions d’occurrence, sous-catégories, comptes d’épargne, configuration, jeton et statut OTP. L’interprétation initiale comme anomalie à investiguer était erronée ; aucun diagnostic supplémentaire ni blocage de livraison n’est retenu au titre de cette trace.

L’automatisation API et navigateur de ces parcours est reportée à la version 2.3.0 sur décision utilisateur et inscrite dans la todo-list : environnement Docker isolé, données dédiées, Playwright, intégration GitHub Actions et rapports sans secrets.

## Rollback applicatif NAS RC7 validé

Résultat communiqué par l’utilisateur le 15 octobre 2026 : ROLLBACK_RC7_NAS_OK. Sur une copie isolée de la sauvegarde run-20261014T180002Z-CYQ6eQ, RC7 démarre et crée une écriture de test ; l’ancienne image démarre ensuite et retrouve cette écriture ; RC7 redémarre et la retrouve à son tour. Aucun remplacement ni restauration de base entre les phases.

Images : RC7 backend sha256:f8d1337610ffb617b0a8e4372c0500f8b46eacd99d6fc2523d086e110e882ef9 ; ancienne image sha256:9930ad2c00ce8223f81dac9e3ae8ba00e3ce9f2772df44e10999bd51139d7276. Conteneur isolé sans réseau, UID 1028:100, limite 192 Mio, capacités retirées. Le script vérifie l’absence de OOM à chaque phase. Données et journaux conservés dans /volume1/suivi-cb-backup-tests/rollback-rc7-20261015.

Portée : compatibilité de démarrage et conservation de cette écriture sur le schéma testé ; ne remplace pas une recette métier complète ni la qualification de la future candidate contenant la correction d’accès refusé. Aucun changement de production.
