# Sécurisation applicative 2.2.0 — 14 octobre 2026

## Périmètre

La branche locale 2.2.0-dev appartient au même dépôt ; le checkout historique sous .cache/release-reference/source-2.1.0 est indépendant et reste inchangé. Les changements préexistants sont conservés. Aucun déploiement, changement NAS ou Keycloak réalisé.

## Authentification

Le serveur de développement protège déjà /api par signature RS256, issuer configuré, audience, expiration, subject, type Bearer, azp du client et rôle app-user. /health et /api/auth/config restent intentionnellement publics. Ce constat concerne le code 2.2.0, pas les images 2.1.0 du NAS.

Durcissements apportés :
- Audience bancaire limitée à KEYCLOAK_AUDIENCE (défaut suivi-cb-api), sans repli global sur account.
- Endpoints OTP self-service seuls utilisent audience account, avec mêmes exigences de signature/issuer/client/rôle. Les jetons contenant les deux audiences restent compatibles.
- Claim realm_access.roles obligatoirement tableau : une chaîne contenant app-user ne peut plus accorder des droits par recherche de sous-chaîne.
- Tests de rejet account-only sur API bancaire, mauvais realm et claims de rôle malformés.

Les mappers de realms suivis dans Git définissent les deux audiences. Leur présence effective sur le NAS doit être vérifiée lors de la recette 2.2.0 ; les réglages client/PKCE vus en console ne prouvent pas le contenu du jeton. Aucun jeton réel ne doit être publié dans les rapports.

## Audits dépendances

Audits production npm actuels : backend 0, frontend 0. Les mises à jour Express/Joi/sqlite3/Angular sont déjà présentes dans les modifications de développement ; aucun audit fix ou changement de lockfile ajouté pendant ce travail.

Audits complets : backend 19 modérées (chaîne Jest/js-yaml/argparse/sprintf-js), frontend 15 (13 élevées, 2 modérées ; chaînes Karma/webpack/braces et uuid). Ces alertes ne sont pas acceptées ni corrigées implicitement.

Versions npm amont vérifiées : braces 3.0.3 et sprintf-js 1.1.3 sont encore signalées vulnérables ; le scanner propose notamment des downgrades Jest/Karma, non appliqués. Éviter overrides majeurs ou audit fix --force sans compatibilité démontrée. Les outils de dev ne doivent pas être exposés au réseau non fiable et ne doivent pas entrer dans l'image backend production.

Écart de compatibilité préexistant : PrimeNG 19 déclare des peers Angular 19, alors que le développement utilise Angular 20. Tests/build passent, mais installation propre et alignement des peers doivent être résolus avant nouveau candidat ; pas de migration PrimeNG silencieuse au milieu des travaux UX existants.

## Vérifications

- Backend npm test : 86 tests Jest et 11 tests sécurité réussis ; tests auth relancés après dernier durcissement, 14 réussis.
- Frontend npm run test:ci : 98 tests réussis.
- Frontend build production : réussi.
- git diff --check : réussi.

## Travail restant

Recette réelle 2.2.0 sur environnement isolé : accès anonyme 401, mauvais realm/audience/signature 401, sans rôle 403, utilisateur autorisé OK, renouvellement et OTP fonctionnels. Aucun test réel sur production autorisé par ce rapport. Construire/scanner les futures images séparément : npm audit ne couvre ni systèmes ni toutes les bibliothèques embarquées.

Dépendances dev : suivre avis amont et résoudre compatibilité peers. Production confinée au LAN jusqu'au déploiement testé d'une version protégée. Migrations historiques : chantier distinct non modifié ici.
