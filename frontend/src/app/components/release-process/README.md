# Procédure de montée de version

Ce guide décrit la procédure complète pour publier une version stable. Il est
prévu pour être suivi dans l'ordre, même après plusieurs mois sans déploiement.

## Le parcours en une minute

1. Terminer, commiter et pousser la branche de développement.
2. Dans l'assistant de release : lancer `dry-run`, puis `prepare`.
3. Construire et tester les conteneurs Docker localement.
4. Dans l'assistant : lancer `deploy` pour fusionner dans `master`, pousser et
   créer le tag stable.
5. Créer la branche de développement de la version suivante.
6. Plus tard, sur le NAS : lancer `update.sh`, puis contrôler la production.

L'interface n'expose volontairement pas la commande technique `full` : elle
enchaînerait `prepare` et `deploy` sans laisser le temps de valider les
conteneurs entre les deux.

## Exemple utilisé dans ce guide

- Branche à livrer : `1.6.0-dev`
- Version stable : `1.6.0`
- Prochaine version : `1.7.0-dev`
- Branche de production : `master`

Remplacer ces valeurs par celles de la release concernée.

## 1. Préparer la branche à livrer

Toutes les modifications applicatives doivent être validées dans Git et poussées avant
d'utiliser l'assistant.

```bash
git switch 1.6.0-dev
git status
git push origin 1.6.0-dev
git fetch origin
```

Points à contrôler :

- `git status` indique un répertoire de travail propre ;
- la branche locale suit bien `origin/1.6.0-dev` ;
- tous les tickets livrés ont le statut `done` et `targetVersion: '1.6.0'`
  dans `dev-todo.data.ts` ;
- aucun secret, fichier `.env` ou fichier de base de données ne fait partie du
  commit.

## 2. Préparer la release dans l'assistant

L'assistant fonctionne uniquement depuis l'environnement local, jamais depuis
l'application de production.

Ouvrir `/release-process`, puis renseigner :

| Champ                 | Valeur d'exemple |
| --------------------- | ---------------- |
| Version stable        | `1.6.0`          |
| Prochaine version dev | `1.7.0-dev`      |
| Branche cible         | `master`         |

Options recommandées :

| Option                 | État   | Raison                               |
| ---------------------- | ------ | ------------------------------------ |
| Commit de préparation  | cochée | conserve toutes les mises à jour Git |
| Restauration sur échec | cochée | restaure les fichiers en cas d'échec |

Les autres réglages sont regroupés sous **Options avancées**. Ils sont utiles
pour le dépannage ou un workflow Git particulier, mais doivent rester
désactivés pendant une release normale. Une explication est affichée sous
chaque option et dans une infobulle au survol.

### 2.1 Lancer `dry-run`

Le `dry-run` vérifie Git et exécute les tests sans préparer ni publier la
release. Ne pas continuer si le rapport se termine en échec.

### 2.2 Lancer `prepare`

`prepare` :

- exécute à nouveau les contrôles et les tests ;
- archive dans `release-notes.data.ts` les tickets `done` de la version stable ;
- les retire de `dev-todo.data.ts` sans créer de doublons ;
- inscrit `1.6.0` dans l'environnement de production ;
- inscrit `1.7.0-dev` dans l'environnement de développement et `package.json` ;
- sauvegarde les fichiers modifiés dans `data/release/backups` ;
- crée le commit de préparation lorsque `commit` est cochée.

À la fin, vérifier que le rapport est réussi et que `git status` est propre.

## 3. Construire et tester la version Docker

Cette étape doit être effectuée **après `prepare` et avant `deploy`** afin de
tester exactement la version qui sera fusionnée dans `master`.

Sous Windows, démarrer Docker Desktop puis lancer depuis la racine :

```bat
scripts\build-production.bat
```

Le script compile Angular en mode production et construit les images Docker.
Il ne démarre pas les conteneurs et ne teste pas l'application à lui seul.

Démarrer ensuite la version construite :

```bash
docker compose up -d
docker compose ps
docker compose logs --tail=100
```

Contrôles manuels minimaux :

- ouvrir `http://localhost:4200` ;
- vérifier que la version affichée est `1.6.0` ;
- vérifier le chargement des comptes et des transactions ;
- ouvrir les principales fonctionnalités modifiées par la release ;
- vérifier qu'aucun conteneur n'est `unhealthy` ou en redémarrage permanent.

Arrêter l'environnement de validation lorsque les contrôles sont terminés :

```bash
docker compose down
```

En cas d'échec, corriger sur la branche de développement, commiter, puis
recommencer depuis `dry-run`.

## 4. Publier la release avec `deploy`

Dans l'assistant, lancer `deploy` et confirmer l'exécution réelle.

`deploy` :

1. relance les tests ;
2. récupère la dernière version de `origin/master` ;
3. fusionne la branche courante dans `master` ;
4. pousse `master` sur GitHub ;
5. crée et pousse le tag `v1.6.0` ;
6. laisse le dépôt local positionné sur `master`.

Cette étape finalise Git, mais elle n'installe rien sur le NAS.

Contrôle final Git :

```bash
git status
git log -3 --oneline --decorate
git ls-remote --heads --tags origin
```

Vérifier que `origin/master` contient la release et que le tag `v1.6.0` existe.

## 5. Créer la branche de développement suivante

Après la publication, repartir du `master` actualisé :

```bash
git switch master
git pull --ff-only origin master
git switch -c 1.7.0-dev
git push -u origin 1.7.0-dev
```

Toutes les nouvelles modifications doivent ensuite être réalisées sur
`1.7.0-dev`, pas sur l'ancienne branche.

## 6. Installer la release sur le NAS

Cette étape peut être réalisée plus tard. Elle suppose que la release est déjà
présente sur `origin/master`.

Sur le NAS :

```bash
cd /volume1/docker/suivi-cb
git status --short --branch
GIT_BRANCH=master ./scripts/update.sh
```

`update.sh` refuse de continuer si le dépôt n'est pas sur `master` ou si des
fichiers suivis contiennent des modifications non validées. Il effectue ensuite :

1. un `git fetch` ;
2. une sauvegarde horodatée de `data/database.db` ;
3. l'arrêt des conteneurs ;
4. le `git pull` de `master` ;
5. la reconstruction des images Docker ;
6. le redémarrage des conteneurs ;
7. un contrôle de santé de l'API ;
8. le nettoyage des anciennes images.

En cas d'échec après la sauvegarde, le script restaure automatiquement l'ancien
commit sur `master`, la base sauvegardée et les anciens conteneurs.

### Première utilisation du nouveau `update.sh`

Si la copie présente sur le NAS est ancienne, copier temporairement le nouveau
script **hors du dépôt**, par exemple dans `/tmp`, puis lancer :

```bash
APP_DIR=/volume1/docker/suivi-cb \
GIT_BRANCH=master \
bash /tmp/update-suivi-cb.sh
```

Ne pas écraser manuellement `scripts/update.sh` dans le dépôt : cela créerait
une modification Git locale et le nouveau script refuserait de continuer.

## 7. Vérifier la production

Sur le NAS :

```bash
cd /volume1/docker/suivi-cb
sudo docker-compose ps
sudo docker-compose logs --tail=100
curl -fsS http://localhost:3001/api/accounts/active
git describe --tags --always
```

Dans le navigateur :

- ouvrir l'URL de production ;
- vérifier la version affichée ;
- contrôler les fonctionnalités principales ;
- vérifier une lecture de la base sans créer de donnée inutile.

La release est terminée seulement lorsque Git, les conteneurs, l'API et
l'interface sont tous validés.

## Que fait chaque bouton ?

| Bouton     | Modifie les fichiers             | Modifie Git distant     | Déploie sur le NAS |
| ---------- | -------------------------------- | ----------------------- | ------------------ |
| `dry-run`  | non                              | non                     | non                |
| `prepare`  | oui                              | non                     | non                |
| `deploy`   | non hors fusion                  | oui, après confirmation | non                |
| `rollback` | restaure le dernier backup local | non                     | non                |

## Règles à retenir

- Toujours suivre l'ordre `dry-run` → `prepare` → test Docker → `deploy` →
  `update.sh`.
- Laisser toutes les options avancées désactivées pour une release normale.
- Ne jamais lancer `update.sh` avant la présence de la release sur
  `origin/master`.
- Ne jamais modifier directement un fichier suivi dans le dépôt du NAS.
- Toujours vérifier la sauvegarde de la base et l'état des conteneurs.
- Le build Docker n'est pas encore automatisé depuis l'assistant de release.
