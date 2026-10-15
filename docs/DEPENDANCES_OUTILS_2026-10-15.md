# Dépendances des outils — correction du 15 octobre 2026

## État

La correction est **partielle** : backend 19 → 0 alerte npm ; frontend 13 → 5
alertes élevées, toutes issues du même avis `braces`. Aucun avis n'est masqué.
Le risque résiduel a été **explicitement accepté par le responsable du projet
le 15 octobre 2026**, dans cette conversation, pour les outils de développement
et de test uniquement. La tâche de traitement/qualification est clôturée ;
`braces` reste techniquement vulnérable et suivi.

Ce suivi complète le [rapport de validation](./VALIDATION_SECURITE_2_2_0_2026-10-15.md).
Les anciens rapports et leurs empreintes restent des constats historiques.

## Backend : chaîne vulnérable supprimée

Jest chargeait `@istanbuljs/load-nyc-config > js-yaml 3 > argparse 1 > sprintf-js`.
L'override est limité au lecteur YAML d'Istanbul : `js-yaml 4.3.2`, utilisant
`argparse 2.0.1` sans `sprintf-js`. Jest conserve sa version et son API.

Le consommateur utilise `load()`, disponible en version 4. Un test charge une
véritable configuration `.nycrc.yml` via Istanbul et vérifie ses valeurs. Les
anciens tags YAML JavaScript non sûrs ne font pas partie du contrat conservé.

## Frontend : retrait des dépendances inutiles

- Remplacement de `@angular-devkit/build-angular` par `@angular/build 20.3.39` :
  builders application, dev-server, extract-i18n et Karma. Le projet utilisait
  déjà le builder application pour son build de production.
- Tests Karma conservés, compilation avec le builder application ; aucune
  migration des assertions Jasmine ni suppression de test.
- Suppression du reporter HTML Karma et de l'override SockJS/uuid devenus inutiles.
- Serveur Karma et serveur de développement liés explicitement à `127.0.0.1`.
  ChromeHeadless reste utilisé avec son sandbox normal.

## Avis restant : GHSA-vfj7-8cjw-p6xm / CVE-2026-93687

[Avis GitHub](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) et
[discussion du projet](https://github.com/micromatch/braces/issues/70).

`braces 3.0.3` peut provoquer un épuisement de pile avec des motifs très imbriqués.
Au contrôle du 15 octobre, aucune version npm corrigée n'est publiée.

Les cinq entrées npm sont `braces`, `chokidar`, `karma`, `karma-jasmine` et
`@angular/build`. Elles représentent la propagation du même avis dans l'arbre.
La dépendance restante est utilisée par les outils de test ; les dépendances de
production ne la contiennent pas. Les motifs concernés proviennent de la
configuration de tests et des chemins du dépôt, pas d'une route métier de l'API.

La restriction à la boucle locale réduit l'exposition du serveur de test. Elle
ne corrige pas le parseur et ne protège pas d'un dépôt ou d'une configuration de
test malveillants. N'exécuter des contributions non fiables que dans des runners
éphémères, sans secrets de production ni accès d'administration NAS.

Ne pas remplacer une dépendance par une API incompatible ni créer un fork de
sécurité uniquement pour faire disparaître le compteur npm. La prochaine revue
amont est à effectuer au plus tard le **22 octobre 2026**, et à chaque mise à jour
des outils. Lorsqu'une version corrigée est publiée : mettre à jour, réinstaller
proprement, relancer les tests et le build, puis archiver le nouvel audit.

L'exception acceptée couvre uniquement GHSA-vfj7-8cjw-p6xm dans les outils
Karma/Chokidar, avec les restrictions décrites ci-dessus. Responsable du suivi :
responsable du projet. Revue au plus tard le **22 octobre 2026**, et immédiatement
si une version corrigée est disponible ou si l'exposition change. Cette date est
un jalon de revue documenté, pas une tâche planifiée automatiquement. L'accord
ne vaut pas approbation de MEP ni acceptation de nouvelles vulnérabilités.

## Vérifications et preuves

Les rapports et journaux de cette correction sont conservés dans
`.cache/dependency-remediation-20261015/`. Résultats réussis après installation
propre sans `--legacy-peer-deps` :

- Backend : 86 tests Jest, 15 tests auth, 19 tests sécurité, dont le test YAML.
- Frontend : 98 tests ChromeHeadless, avec génération de couverture, et build
  production réussi. La couverture mesurée est de 43,65 % des instructions ;
  le succès des tests ne signifie pas que tous les parcours sont couverts.
- Audits complets : backend 0 ; frontend 5 élevées, toutes liées à `braces`.
- Audits production : 0 des deux côtés ; `git diff --check` réussi.
- `webpack`, `webpack-dev-server`, `@angular-devkit/build-angular`, `vitest` et
  `sprintf-js` absents des arbres installés concernés.

[Résumé structuré des preuves](./audit/2026-10-15/dependency-remediation.json).
Ce changement d'outils ne constitue pas un nouveau candidat d'images approuvé
pour la MEP. La ligne de todo est clôturée avec cette exception documentée.
