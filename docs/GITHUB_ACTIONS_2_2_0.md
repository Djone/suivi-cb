# Lot 2 — GitHub Actions (2.2.0)

La recette NAS/préproduction est conservée pour la fin. Aucun déploiement NAS,
tag Git ou publication de release n’est activé. Les protections de branche ont été complétées après le premier cycle vert, comme demandé.

## Chaîne livrée

`.github/workflows/ci.yml` exécute sur les PR et les push vers `master`,
`2.2.0-dev` et `work/**` :

1. `Quality` : installations `npm ci` séparées, lint JavaScript/TypeScript et
   templates Angular, TypeScript application/tests, politiques de sécurité,
   tests backend et frontend, audits de dépendances.
2. `Docker and browser qualification` : construction unique depuis un commit
   propre, images Linux amd64 non privilégiées, inspection de l'archive,
   suites API/Playwright, Keycloak jetable avec OTP, migrations et rollback.
3. Scans Trivy épinglés : secrets du commit et des images, vulnérabilités système
   et dépendances présentes dans les images, SBOM CycloneDX. Les résultats
   publiés ne contiennent ni valeurs de secrets ni extraits de code correspondants.
4. `Required CI` reste en échec si un contrôle obligatoire manque ou échoue.
   Les rapports de qualité sont conservés 30 jours, le candidat qualifié 14 jours.
   La construction utilise `--pull --no-cache` pour réexécuter les mises à jour
   Alpine ; une ancienne couche `apk upgrade` ne vaut pas mise à jour actuelle.
   Les images sont archivées une fois puis réutilisées ; aucune reconstruction
   dans la publication.

Les actions sont épinglées sur un SHA complet. Les PR utilisent uniquement des
runners GitHub hébergés, sans secrets NAS, jeton d'écriture ou exécuteur local.
Les preuves sont liées au commit, à l'exécution et aux identités des images.
Un rollback automatisé utilise les anciens sources dans le runtime courant :
c'est une fixture de compatibilité, pas une reproduction de l'ancienne image NAS.
La validation de cette dernière reste une vérification NAS distincte.

## Publication GHCR : désactivée par défaut

Le job `Publish approved candidate to GHCR` ne peut être lancé que par
`workflow_dispatch` depuis une branche protégée, avec une version nouvelle
`2.2.0-rc.N`, et la variable `CI_ENABLE_REGISTRY_PUBLISH=true`.
L’environnement `candidate-registry` est créé : approbateur obligatoire, auto-approbation et contournement administrateur interdits, branches protégées seulement. Le script interroge cette
configuration et refuse la publication si elle est absente ou invérifiable.
Vérifier que le forfait GitHub permet ces protections sur le dépôt concerné.

Le jeton limité `GITHUB_TOKEN` est transmis à Docker par l'entrée standard,
avec une configuration Docker temporaire supprimée ensuite. La publication
refuse un tag candidat existant ou une vérification de son absence impossible.
Les deux tags sont vérifiés avant le premier push ; une publication interrompue
peut laisser un seul tag : ne pas réutiliser cette version, produire une nouvelle
candidate. Il n'existe pas de transaction atomique entre deux packages GHCR.
Les images repullées par digest doivent conserver leur identité, architecture
et label de commit. Le manifeste publié contient les références immuables.

## Validation du 20 octobre

Le premier passage a mesuré 17,9 % des lignes et 16,21 % des branches,
malgré 86 tests backend réussis. Le seuil existant de 70 % a été conservé.
Les nouveaux scénarios utilisent les vrais routeurs et une base SQLite en mémoire :
comptes, catégories, récurrences, historique, exceptions, épargne, allocations
atomiques, véhicules et répartition du couple. Ils couvrent aussi les erreurs SQL
et la reprise, les entrées invalides et les frontières HTTP/CORS/documentation.
La suite compte désormais 97 tests backend ; couverture locale : 85,83 % des lignes,
70,88 % des branches, 92,30 % des fonctions. Les 102 tests frontend passent aussi.
Un rapport issu de sources non committées reste explicitement non qualifiable.
La validation finale des mêmes commandes dans GitHub reste distincte.

L'exception `braces@3.0.3` n'autorise que l'avis
`GHSA-vfj7-8cjw-p6xm`, côté outillage frontend, et ses dépendants transitifs.
Toute autre alerte bloque ; cette exception expire après le 22/10/2026 UTC.
Aucun renouvellement automatique ni approbation de production n'est implicite.
L'échéance accompagne aussi le manifeste : une candidate qualifiée avant
expiration ne peut pas être promue après sans réévaluation.

Le premier cycle Linux a également révélé des fins de ligne mixtes dans
`account.controller.js` : elles ont été normalisées en LF, sans modifier la
logique. Une relance d'exécution ne reconstruit pas la même candidate :
démarrer une nouvelle exécution pour obtenir un nouvel identifiant.

## Reproduction locale

Avec les dépendances installées et Chrome disponible :

```sh
npm run ci:quality
```

Le rapport `.cache/ci/quality/quality.json` distingue les résultats. Un code
retour non nul doit être conservé comme échec. Pour les images, depuis un commit
propre et avec Docker disponible :

```sh
CANDIDATE=2.2.0-rc.N node scripts/ci/candidate.cjs build
cp .cache/ci/quality/quality.json .cache/ci/package/quality.json
node -e "require('./scripts/ci/candidate.cjs').checksums()"
node scripts/ci/candidate.cjs exercise
node scripts/ci/scan.cjs
node scripts/ci/candidate.cjs qualify
```

Sous PowerShell, définir `$env:CANDIDATE='2.2.0-rc.N'` avant `build`.
`qualify` refuse le rapport Quality en échec. Les commandes utilisent un
répertoire de package neuf et ne réemploient pas un tag d'image existant.

## Exécuteur et déploiement NAS : reste à installer et valider

Le dépôt applicatif est public : ne pas y attacher d'exécuteur auto-hébergé.
Prévoir un dépôt privé de contrôle, avec revue de sa branche `main`, environnements
`preproduction` / `production`, approbations humaines et restrictions de branche.
Le contrôleur `deploy-controller/nas-preproduction.sh` est préparé, non installé : mode plan par défaut, application sous verrou local explicite. Voir son README.
Le 20/10, seul le NAS est disponible. Le dépôt privé Djone/suivi-cb-deploy a été créé, avec Actions désactivé. Privilégier une tâche NAS de récupération
de demandes approuvées, déclenchée ponctuellement, sans runner GitHub permanent.
Le mode plan local et le moteur TAR isolé sont préparés ; récupération authentifiée, provenance automatique et installation NAS restent à implémenter et tester. Aucun accès SSH public supplémentaire ne doit être exposé.

Si le secours SSH est utilisé, prévoir une clé dédiée à commande forcée, sans shell général,
avec un wrapper root limitant les chemins, les services et les opérations ;
aucun accès au socket Docker ni sudo général pour les PR ou le compte de transfert.
Les secrets NAS et GHCR lecture seule resteront dans ce dépôt privé / sur le NAS.
Le wrapper, son installation et les droits effectifs doivent être testés avant
activation : cette étape n'est pas encore réalisée.

`scripts/ci/plan-deployment.cjs MANIFEST preproduction|production` produit le
plan depuis un manifeste qualifié contenant les références GHCR. La promotion
prévoit les mêmes digests, une sauvegarde SQLite cohérente avant bascule, des
contrôles de santé/version/accès, et un retour aux images précédentes conservant
la base courante. Elle ne contient aucune restauration automatique des données
ni aucun redémarrage de Keycloak. Ce plan n'est pas un moteur de déploiement.

À terminer après une CI verte : publication GHCR approuvée, exécuteur contrôlé,
déploiement préproduction sans rebuild, simulation isolée de promotion/rollback,
puis recette NAS finale. Vérifier alors `linux/amd64`, les digests de registre
et les identités de configuration réellement importées sur Synology.
Conserver le transfert TAR/SSH existant avec `SHA256SUMS` comme secours.
N'exiger les noms des checks dans les rulesets qu'après une vraie exécution réussie.

## Cycle GitHub attesté et blocages conservés

Le cycle PR 39407567092 a réussi : qualité, qualification Docker/navigateur et Required CI. Preuve : docs/audit/2026-10-20/github-ci-results.json. Le commit de fusion testé est distingué du commit de la branche. Ce résultat historique ne valide pas automatiquement les modifications suivantes.

Required CI est obligatoire, avec branche à jour, sur master et 2.2.0-dev. Les trois environnements candidate-registry, preproduction et production exigent une revue, interdisent auto-approbation et contournement administrateur et limitent les branches. Le seul relecteur configuré est Djone : il ne peut pas approuver son propre déclenchement. Sur demande utilisateur, les publications restent bloquées ; CI_ENABLE_REGISTRY_PUBLISH reste absent. Aucun déploiement ni publication GHCR n’a été déclenché.

Le contrôleur local prépare la voie TAR vérifiée et une sauvegarde SQLite cohérente des seules données isolées. La provenance GitHub reste contrôlée manuellement ; récupération automatique des demandes approuvées, installation NAS et promotion production restent à terminer. La recette NAS est réservée à la fin.
