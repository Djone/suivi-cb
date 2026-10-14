# Documentation du dépôt — développement uniquement

La page `/documentation` est réservée au frontend de développement. Elle
réutilise Angular, PrimeNG, PrimeIcons et la modale de confirmation du projet.
La configuration production remplace `documentation.routes.ts` par un module
vide : le composant, son service et son parseur Markdown ne sont pas inclus
dans les bundles préproduction/production. Le menu est également masqué.

## Accès aux fichiers

Le backend expose `/api/documentation` uniquement lorsque `NODE_ENV` est absent
(démarrage local historique) ou vaut `development`, et que
`DOCUMENTATION_DISABLED` ne vaut pas `true`. L'authentification et le rôle
applicatif existants sont requis. L'adresse réelle du socket doit être une
adresse loopback ; les en-têtes de proxy ne permettent pas de contourner ce
contrôle. Le backend doit fonctionner sur le poste contenant ce dépôt.

`DocumentationStore` lit récursivement les fichiers `docs/**/*.md` à chaque
chargement. Le front matter YAML fournit title, summary/description,
owner/author, category/space, status, updated/updated_at/date. Les valeurs
absentes sont déduites du titre Markdown, du nom du fichier et des trois espaces
initiaux. Les auteurs et dates absents sont indiqués comme non renseignés.
Les chemins des sous-dossiers restent visibles dans la navigation.

## Écritures réelles

- Nouvelle note crée immédiatement un fichier brouillon dans `docs/Notes-equipe`.
- Modifier prépare un tampon d'édition ; Annuler abandonne ce tampon.
- Publier enregistre le contenu et les métadonnées dans le fichier Markdown.
  Le chemin ne change pas lorsque le titre est modifié. Les métadonnées YAML
  supplémentaires et leurs commentaires sont conservés.
- Supprimer définitivement supprime physiquement le fichier après confirmation.
  La dernière page est protégée côté client et serveur.
- Actualiser relit les fichiers, y compris les changements faits depuis l'IDE.

Les écritures utilisent un fichier temporaire puis un renommage atomique.
Chaque mutation vérifie l'empreinte SHA-256 de la version lue : une modification
externe provoque une réponse 409 sans écraser ni supprimer le fichier.
Le tampon d'édition est conservé en cas d'échec de publication ; copier les
changements avant d'actualiser pour résoudre un conflit. Les fichiers sont
limités à `docs`, aux fichiers Markdown physiques ; traversées de chemins,
liens symboliques et jonctions sont refusés. Les mutations utilisent l'identité
vérifiée par le backend, jamais un auteur fourni par le client.

Aucun commit Git n'est créé automatiquement. Les changements et suppressions
apparaissent dans le diff du dépôt, comme ceux effectués depuis l'IDE.
Le stockage navigateur du précédent prototype n'est plus utilisé ni migré
implicitement vers les fichiers du dépôt.

## Exclusion des déploiements

Le dossier `docs`, les modules serveur d'accès aux fichiers et tout ancien
catalogue statique `frontend/public/documentation` sont exclus du contexte
Docker. Aucun catalogue documentaire n'est produit. Les assets Angular ignorent
également ce dossier, même s'il contient un ancien fichier local. L'image backend
force `DOCUMENTATION_DISABLED=true` en plus de `NODE_ENV=production`.
Les Compose de préproduction et de production utilisent `NODE_ENV=production`.
Les fichiers Markdown ne sont pas servis statiquement par le backend.

Le rendu prend en charge titres, listes imbriquées, étapes, checklists, encadrés,
liens entre documents, tableaux et code. Le HTML brut est échappé et Angular
assainit le rendu. Les images et liens hors de `docs` restent affichés en texte.

## Vérifications

Depuis `backend` : `npm run test:security` ou `npm test`.
Depuis `frontend` : `npm run build`,
`npm run build -- --configuration development`,
`npm test -- --watch=false --browsers=ChromeHeadless`, `npm run lint`.
Les tests d'écritures/suppressions utilisent exclusivement des dossiers
Markdown temporaires ; aucun fichier réel du dépôt n'est supprimé par les tests.
Le lint reste bloqué par l'absence de configuration ESLint dans le dépôt.
