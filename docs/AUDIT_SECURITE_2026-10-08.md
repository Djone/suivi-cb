# Audit de sécurité avant MEP — 8 octobre 2026

## Marche à suivre pour la candidate suivante

**Oui, installer une rc2 avant de refaire les contrôles applicatifs sur le NAS.**
Le relevé d’architecture et la sauvegarde peuvent précéder son installation.
[CHECKLIST_RC2_PREPRODUCTION.md](./CHECKLIST_RC2_PREPRODUCTION.md) fournit les
commandes de construction sur le PC Windows, export/inspection du tar, transfert
et chargement sur le NAS, sauvegarde, démarrage et validation en préproduction.
Les fichiers de réception sont dans
`/volume1/docker/suivi-cb-preprod/releases/2.2.0-rc2/`.
Le Compose dédié est `docker-compose.preprod.rc2.yml`, sans build sur le NAS.
La checklist prépare les opérations ; aucune rc2 n’est déclarée construite ou validée.

**Décision : package rc1 non validable pour la production ; audit non clôturé.**
La validation fonctionnelle globale de préproduction annoncée par l’utilisateur
est conservée. Elle ne couvre pas la nouvelle candidate issue des corrections
ci-dessous, ni les restaurations isolées, que l’utilisateur confirme ne pas
avoir testées.

## Périmètre et preuves

Revue ciblée de la couche HTTP, JWT/Keycloak, des accès aux API, des modèles SQL,
de la validation des entrées, du stockage des jetons et des traces navigateur,
des builds Docker et de l’archive locale. Tests automatisés et audits npm
relancés, contrôles HTTPS non authentifiés sur le domaine de préproduction.
Ce travail ne certifie pas l’absence de toute faille métier et ne constitue
pas un test d’intrusion exhaustif ou une analyse de l’historique Git des secrets.

Commit de base du dépôt : `b8645ed17cc6572d01f7b4ed581df277c62e2499`.
Le dépôt contient des modifications non commitées préexistantes ; ce commit
seul ne décrit pas les sources testées. Aucun commit, push ou déploiement effectué.
Les preuves JSON sont dans [audit/2026-10-08](./audit/2026-10-08/).

| Vérification | Résultat observé |
| --- | --- |
| Backend Jest | 12 suites, 85 tests réussis |
| Authentification/OTP | 11 tests réussis |
| Sécurité HTTP | 5 tests réussis |
| Frontend après retrait des traces | 73 tests réussis, commande terminée normalement |
| Build Angular de production après corrections | Réussi |
| Syntaxe Nginx corrigée | Validée dans un conteneur isolé |
| Backend npm production | 0 alerte |
| Frontend npm production | 0 alerte |
| Backend npm complet | 19 alertes modérées, 0 élevée/critique |
| Frontend npm complet | 15 alertes : 13 élevées, 2 modérées, 0 critique |
| Restauration SQLite sur base fictive locale | Intégrité, clés étrangères et compte de lignes OK |
| Restauration des bases NAS | Non effectuée ; confirmation utilisateur |

Le test SQLite local valide le fonctionnement du script, pas la restaurabilité
des sauvegardes NAS. Le navigateur et Nginx doivent encore valider la CSP sur
les parcours réels. Les commandes NAS sont dans [AUDIT_SECURITE_NAS.md](./AUDIT_SECURITE_NAS.md).

## Blocages dans le package existant

Archive analysée : `suivi-cb-preprod-2.2.0-rc1.tar`.
SHA-256 : `47d365b78bdd7be39d616e8604dda497af8046900f4740f4e33124b9b85d253c`.

1. **Base embarquée** : la couche applicative backend contient
   `app/database.db`. Son contenu n’a pas été lu ; sa sensibilité n’est pas
   déterminée. La présence suffit à rejeter cette archive pour diffusion/MEP.
   Monter une autre base ne retire pas ce fichier des couches de l’image.
2. **Écart avec la préproduction** : l’image frontend de l’archive n’a pas
   l’exception `/silent-check-sso.html` dans Nginx ; le domaine de préproduction
   renvoie pourtant 200 + SAMEORIGIN. Cela confirme une différence observable
   entre le package et la configuration servie. Les identifiants des images
   NAS et les modifications temporaires du conteneur restent à relever.

Rapport : [package-inspection.json](./audit/2026-10-08/package-inspection.json).
Les identifiants OCI locaux sont `sha256:b8a2b37b7d2376328a722daade940ec753acffde2b58646a5b01585cefc51702`
(backend) et `sha256:65286df2d269713b29bdb6078356401eae8a5abe0f9621c0978c69342b6f940c`
(frontend). Le rapport distingue les digests des configurations des identifiants OCI.

## Corrections réalisées

- Exclusions Docker récursives des bases, WAL/SHM, SQLite, CSV et caches npm.
  Une image backend d’audit a été construite et toutes ses couches inspectées :
  aucun fichier sensible correspondant aux motifs contrôlés.
- Retrait de 27 instructions console.log/debug frontend, dont des traces
  de transactions, comptes et soldes. Les erreurs restent visibles pour diagnostic.
- Retrait du lien PrimeIcons externe non versionné ; le CSS et les polices
  de PrimeIcons sont déjà inclus par Angular depuis le package local.
- Préparation d’une CSP globale **Report-Only**, adaptée aux sources observées :
  même origine, Keycloak et polices Google. Scripts inline et eval non autorisés
  par cette politique candidate ; styles inline conservés pour Angular/PrimeNG.
  Le SSO utilise un script externe de même origine. Aucune activation en production.
- Suppression des en-têtes backend redondants à la frontière Nginx pour éviter
  les doubles X-Frame-Options, nosniff et Referrer-Policy sur les API.

L’image `suivi-cb-audit-backend:2026-10-08` est uniquement une preuve locale
et n’est pas une candidate validée sur le NAS. Voir
[corrected-backend-inspection.json](./audit/2026-10-08/corrected-backend-inspection.json).
La correction nécessite une nouvelle construction de candidate, puis sa validation
en préproduction ; l’archive
rc1 existante est conservée comme preuve et n’a pas été remplacée.

## Contrôles HTTPS réels

- Frontend : 200, nosniff, DENY, no-referrer et Permissions-Policy présents.
- API sans jeton et jeton invalide : 401 avec Cache-Control no-store.
- SSO silencieux : 200, SAMEORIGIN, frame-ancestors self, no-store.
- Configuration publique : URL auth HTTPS, realm suivi-cb-preprod, client attendu.
- Découverte OIDC validée via curl ; issuer attendu. La sonde Node a échoué
  pour cette URL, puis le contrôle curl a réussi sans désactiver TLS.
- **HSTS absent** sur les réponses observées : configurer le reverse proxy DSM.
- **HTTP sans redirection HTTPS** : le domaine HTTP renvoie 200. Configurer
  une redirection vers le domaine HTTPS ; le contenu HTTP n’a pas été interprété
  comme une preuve que l’application bancaire elle-même est servie en clair.
- CSP globale absente de la préproduction actuelle ; seule la page SSO a
  une politique limitée à frame-ancestors.

Preuves : [preprod-http.json](./audit/2026-10-08/preprod-http.json) et
[preprod-oidc.json](./audit/2026-10-08/preprod-oidc.json).

## Risques résiduels et limites

Les alertes npm complètes comptent les dépendances parentes ; elles ne sont
pas autant de failles indépendantes. Le frontend conserve les trois avis
braces, uuid et webpack-dev-middleware documentés précédemment. Le backend
complet révèle également [sprintf-js — GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c),
via les outils de test. L’avis consulté ne publie pas de correctif. Ces outils
ne font pas partie de l’installation npm de production du backend, ni du serveur
Nginx frontend. Les audits npm ne couvrent pas les composants système de l’image
ou toutes les utilisations du bundle. Aucune mise à jour majeure forcée appliquée.

- Scan Alpine/Node/Nginx encore nécessaire : Docker Scout est installé, mais
  les deux scans ont été refusés faute de connexion au service Docker. Aucun
  résultat de scan d’image n’est déclaré réussi.
- Les images auditées utilisent root par défaut. Prévoir une exécution avec
  droits réduits et vérifier les droits de volumes ; ce durcissement n’a pas
  été imposé sans validation de la compatibilité NAS.
- Les JWT vérifient signature RS256, issuer, audience, exp/sub/iat, client,
  type et rôle. Le stockage des jetons reste en mémoire. Les requêtes SQL
  examinées utilisent des valeurs liées ; certains noms de colonnes dynamiques
  reposent sur les schémas Joi des routes et méritent une liste explicite au
  niveau modèle lors d’un durcissement ultérieur.
- La base métier est partagée entre les détenteurs du rôle app-user, conformément
  au fonctionnement actuel. La revue ne valide pas une isolation par utilisateur.
- Les tests OTP locaux vérifient les refus et l’appartenance des credentials ;
  la politique de réauthentification effective pour supprimer l’OTP doit être
  vérifiée sur Keycloak. La présence du claim acr seule ne prouve pas un facteur OTP.
- L’accès SSH automatique au NAS est refusé ; l’utilisateur exécutera les commandes.

## Conditions de clôture avant validation production

1. Refaire une candidate en préproduction intégrant les corrections, consigner
   ses images et confirmer l’absence de données/secrets dans toutes ses couches.
2. Régler HSTS et la redirection HTTP, puis revérifier les réponses publiques.
3. Observer, corriger et activer la CSP validée ; refaire les parcours sur les
   images finales après tout changement de politique intégré à l’image.
4. Tester les restaurations SQLite et PostgreSQL NAS et compléter les lectures
   applicatives/connexion Keycloak dans une pile isolée.
5. Consigner les contrôles NAS détaillés 403/rôle, sessions, SMTP et OTP.
6. Scanner les composants système des images et traiter les résultats ; consigner
   le traitement ou l’acceptation du risque des dépendances de développement.
7. Exporter/promouvoir les images réellement validées en préproduction, comparer
   leurs identifiants en production et prévoir le retour arrière.

Aucun feu vert production donné tant que ces preuves manquent.
