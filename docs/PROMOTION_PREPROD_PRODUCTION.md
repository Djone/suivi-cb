# Promotion de la préproduction vers la production

## Règle pour chaque MEP

Le parcours obligatoire est **développement → préproduction → validation →
production**. La préproduction a été validée et testée OK par l’utilisateur
(confirmation du 8 octobre 2026). Chaque nouvelle candidate doit suivre
ce même parcours avant la MEP.

La production utilise les images backend et frontend effectivement testées
en préproduction. Aucun build depuis le poste de développement, aucun build
sur la production et aucun changement de code après validation ne doivent
remplacer cette candidate. Toute modification de l’image nécessite une
nouvelle validation en préproduction, y compris une correction Nginx copiée
temporairement dans un conteneur.

## 1. Consigner la candidate validée

Pour les candidates créées par [l’automatisation](./AUTOMATISATION_CANDIDATE.md),
enregistrer l’approbation explicite avec `release:candidate:approve` après les
tests préproduction. Conserver `approval.json`, le compte rendu et le package.
Avant la bascule, vérifier que les IDs et le commit correspondent au manifeste
et à cette approbation. Cette attestation opérateur ne remplace pas les essais NAS.

Avant toute intervention en production, relever :

- La version, le commit source et la date réelle des essais.
- Les identifiants des images utilisées par les conteneurs de préproduction.
- Les résultats fonctionnels et les contrôles de [SECURITE_MEP.md](./SECURITE_MEP.md).
- Le traitement ou l’acceptation explicite des alertes résiduelles pour la release.
- La configuration prévue en production, les sauvegardes et le retour arrière.

Sur le NAS, ces commandes sont en lecture seule :

```sh
sudo docker inspect --format '{{.Name}} {{.Image}}' suivi-cb-preprod-backend suivi-cb-preprod-frontend
sudo docker image inspect suivi-cb-preprod-backend:2.2.0-rc1 suivi-cb-preprod-frontend:2.2.0-rc1 --format '{{.Id}} {{json .RepoTags}}'
```

Adapter les tags à la candidate. Les identifiants associés aux tags doivent
correspondre à ceux des conteneurs testés ; un tag seul peut être déplacé et
ne constitue pas une preuve. Vérifier aussi qu’aucun fichier applicatif ou
Nginx testé n’a été modifié dans le conteneur sans être intégré à l’image.
Si c’est le cas, reconstruire en préproduction et refaire la validation.

## 2. Préparer la production sans reconstruire

La production existante utilise des conteneurs individuels : relever leurs
images, variables, volumes, réseau et destination du reverse proxy avant
de préparer leur remplacement. Préserver les anciennes images et la
configuration nécessaire au retour arrière.

Pour une production gérée par Compose, préparer dans le dossier de production
un fichier distinct `docker-compose.production.yml`, à partir de
`docker-compose.yml` :

- Supprimer les deux sections `build`.
- Définir `image` pour chaque service avec l’identifiant local `sha256:…`
  relevé sur son conteneur de préproduction, sur ce même moteur Docker.
- Ajouter `pull_policy: never` pour chaque service ; les images sont déjà sur le NAS.
- Conserver les noms de production et les volumes de données de production.
- Utiliser les variables de `.env.production`, notamment le realm `suivi-cb`,
  et non `suivi-cb-preprod`.
- Garder le backend sans port publié et le reverse proxy HTTPS vers le frontend.

Si la production est sur un autre moteur Docker, exporter les images exactes
avec `docker save`, les importer avec `docker load` et vérifier leurs identifiants,
ou utiliser des références de registre figées par digest. Ne pas reconstruire.
Ne pas copier les bases, comptes, secrets ou volumes de préproduction.

Vérifier le fichier préparé, depuis le dossier de production :

```sh
sudo docker compose -p suivi-cb --env-file .env.production -f docker-compose.production.yml config --quiet
```

## 3. Effectuer la MEP

1. Vérifier que la candidate et le dossier de validation correspondent aux
   images préparées ; ne pas lancer la MEP si cette correspondance manque.
2. Prendre une sauvegarde cohérente SQLite et une sauvegarde PostgreSQL/Keycloak,
   avec une procédure de restauration testée et des droits d’accès adaptés.
   Voir [les sauvegardes](./SECURITE_MEP.md#vérifier-les-sauvegardes).
3. Pendant la fenêtre prévue, arrêter les anciens conteneurs de production.
   Prévoir la libération de leurs noms si une nouvelle pile Compose les reprend ;
   ne pas supprimer leurs données ni les images de retour arrière.
4. Démarrer la configuration de production préparée, sans construction :

```sh
sudo docker compose -p suivi-cb --env-file .env.production -f docker-compose.production.yml up -d --no-build --pull never
sudo docker compose -p suivi-cb --env-file .env.production -f docker-compose.production.yml ps
sudo docker compose -p suivi-cb --env-file .env.production -f docker-compose.production.yml exec frontend nginx -t
sudo docker inspect --format '{{.Name}} {{.Image}}' suivi-cb-backend suivi-cb-frontend
```

5. Comparer les deux identifiants de production à ceux consignés en préproduction.
6. Vérifier sur le domaine de production : HTTPS et en-têtes, API sans jeton
   (401), rôle requis (403), connexion, renouvellement, déconnexion et lecture
   des données. Vérifier que `/api/auth/config` annonce le realm de production.
   Vérifier les journaux et l’absence de port backend publié.
7. Consigner la date de MEP, les images, les contrôles et la décision finale.

En cas d’échec, arrêter la nouvelle pile et remettre les anciennes images avec
leur configuration. Si une migration a modifié les données, suivre la procédure
de restauration cohérente prévue, backend arrêté ; ne pas écraser une base active.
Conserver les sauvegardes et anciennes images jusqu’à validation de la production.

## Publication Git et automatisation

Les commandes `release:deploy` et `release:full` ainsi que la publication GitHub
ne remplacent pas cette validation et ne prouvent pas quelles images sont
exécutées sur le NAS. Consigner le commit de la candidate et vérifier sa
correspondance avec la release publiée. Préparer les versions avant le build
en préproduction : un changement de version intégré au bundle après les tests
nécessite une nouvelle candidate et une nouvelle validation.

Cette procédure définit le contrôle obligatoire ; elle ne met pas en place
un verrou automatique dans la CLI de release ou dans GitHub Actions.
