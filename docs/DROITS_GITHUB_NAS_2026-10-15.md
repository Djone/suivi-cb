# Protections GitHub, workflows et ACL NAS

## État constaté

Lecture des API GitHub du dépôt Djone/suivi-cb le 15 octobre 2026 : master et 2.2.0-dev non protégées, aucun ruleset. Un workflow actif : Publish GitHub release. Aucun paramètre distant modifié ; le connecteur ne fournit pas de modification des protections et GitHub CLI n’est pas installé. Les permissions administratives du compte connecté ne sont pas attestées.

Durcissement local du workflow : permissions globales contents: read, contents: write limité au job de publication, action github-script v8 figée sur le commit officiel ed597411d8f924073f98dfc5c65a23a2325f34cd, timeout 10 minutes et concurrence sérialisée sans annulation. YAML et syntaxe JavaScript vérifiés localement ; aucune exécution GitHub déclenchée. Changements non poussés. Le comportement existant de publication et de déplacement du tag majeur est conservé ; ne pas créer de tag pendant cette phase.

## Configuration à appliquer dans GitHub

### Vérification des exports et de l’état distant après configuration

Les exports Protection Master.json et Protection 2.2.0-dev.json ont été comparés aux API GitHub : rulesets 25168658 et 25168742 actifs, cibles exactes master et 2.2.0-dev, aucune exclusion, PR obligatoire, suppression et force-push bloqués. Les deux branches retournent protected: true. Les exports déclarent une liste de bypass vide ; l’API publique ne restitue pas ce champ. Aucune approbation indépendante requise (compteur 0), conformément au réglage prévu pour un mainteneur seul ; ce réglage ne constitue pas une revue indépendante.

L’écart initial required_review_thread_resolution=false sur 2.2.0-dev a été corrigé par l’utilisateur puis relu via l’API : la valeur est désormais true. Les protections de branches demandées sont validées. Les endpoints administratifs actions/permissions et actions/permissions/workflow répondent 401 sans authentification administrateur disponible ; aucune conclusion sur ces réglages n’est déduite de ce refus. Les permissions Actions, la publication du durcissement local et les ACL NAS restent à vérifier séparément.

Dans Settings → Branches → Add classic branch protection rule, créer une règle pour master et une pour 2.2.0-dev :

- Require a pull request before merging.
- Require conversation resolution before merging.
- Do not allow bypassing the above settings, y compris pour les administrateurs.
- Allow force pushes et Allow deletions restent désactivés.
- Si un second mainteneur indépendant peut relire : Require approvals, une approbation, et Dismiss stale pull request approvals. Si le dépôt est maintenu seul, garder l’obligation de PR sans approbation indépendante impossible à obtenir ; documenter cette limite. Une auto-revue n’est pas une approbation indépendante.
- Ne pas rendre obligatoires des checks inexistants ; la CI automatisée est prévue en 2.3.0. Les tests et preuves locaux restent nécessaires.

Relire les règles après enregistrement. Une protection n’est validée que lorsqu’elle apparaît active dans GitHub et que l’API de la branche retourne protected: true. Vérifier également l’absence de règle plus spécifique qui prendrait priorité.

Dans Settings → Actions → General : choisir les permissions de workflow en lecture par défaut, désactiver l’autorisation de création/approbation des PR par Actions si elle n’est pas nécessaire et restreindre les actions autorisées aux actions utilisées. Le job de publication possède son exception contents: write explicite. Vérifier les collaborateurs avec accès d’écriture et les accès des applications GitHub ; ne supprimer aucun compte légitime sans connaître son besoin. Les secrets ne doivent pas être copiés dans les preuves.

## Relevé NAS en lecture seule

```sh
sudo sh <<'SH'
set -eu
for P in \
  /volume1/docker/suivi-cb \
  /volume1/docker/suivi-cb/data \
  /volume1/docker/suivi-cb-preprod \
  /volume1/docker/suivi-cb-preprod/recette-2.2.0-rc.8 \
  /volume1/docker/suivi-cb-preprod/recette-2.2.0-rc.8/data \
  /volume1/suivi-cb-backups \
  /volume1/suivi-cb-backups/backup-daily.sh \
  /volume1/suivi-cb-backups/publish-backups.sh \
  /volume1/SuiviCB-BackupVault \
  /volume1/SuiviCB-BackupVault/published; do
  printf '\nPATH=%s\n' "$P"
  if test -e "$P"; then
    ls -ldn "$P"
    /usr/syno/bin/synoacltool -get "$P"
  else
    echo ABSENT
  fi
done
SH
```

Attendus : scripts de sauvegarde/publication et répertoire privé root:root en 0700, sans ACL supplémentaire ouvrant l’accès ; base applicative accessible au seul UID/GID requis et aux administrateurs justifiés ; coffre et données publiées accessibles aux tâches Hyper Backup et aux administrateurs nécessaires. Examiner droits hérités et traversée des parents, ainsi que les permissions du partage docker et du coffre dans DSM. Le mode Unix seul ne prouve pas les droits effectifs si des ACL DSM existent. Ne pas lancer de chmod/chown récursif sur les partages ni supprimer les ACL globalement. Le compte SSH administrateur est privilégié par conception ; un accès observé de sa part n’est pas une preuve d’accès pour les utilisateurs ordinaires.

Les fichiers .env doivent être inspectés uniquement pour leurs métadonnées et ACL, jamais affichés : relever leurs chemins depuis la configuration de déploiement avant d’appliquer un changement. Vérifier aussi les groupes effectifs des utilisateurs ordinaires via DSM. Les restrictions d’accès restent en attente tant que ces relevés ne sont pas fournis et analysés.

## Portée

### Relevé partiel transmis pour la production

`/volume1/docker/suivi-cb` appartient à app-dev (UID 1038), avec ACL complètes pour ContainerManager, developers, administrators et le propriétaire. La capture des membres de developers montre app-dev coché et admin non coché. Le compte app-dev est décrit comme compte technique de développement. DSM affiche Aucun accès aux partages docker, coffre et USB pour ce compte ; cette vue ne suffit pas à déterminer ses accès locaux effectifs aux sous-dossiers.

Le dossier data est en mode Linux 0700, la base database.db en 0600, tous deux UID 1028 et GID 100. Ces métadonnées sont restrictives ; l’identité correspondant à UID 1028 et les accès effectifs de app-dev restent à vérifier. Ne pas conclure à une isolation complète à partir du seul mode de la base : des droits d’écriture sur son répertoire parent ou sur la configuration de déploiement peuvent permettre une influence indirecte. Aucun changement d’ACL réalisé ; attendre les tests de lecture/écriture sans mutation et la justification des accès avant correction ciblée.

### Correction et vérifications effectives

L’utilisateur confirme que les transferts et déploiements utilisent GodOfNasAugerie, administrateur principal, et non app-dev. UID 1028 correspond à GodOfNasAugerie ; app-dev est UID 1038, groupes users et developers. Avant correction, app-dev pouvait lire/écrire/traverser le parent de production, mais pas data, database.db, le répertoire privé de sauvegardes ni published.

Après sauvegarde du relevé ACL dans le répertoire privé, le propriétaire du seul parent de production a été changé en root et l’entrée developers retirée. ACL finale : ContainerManager, administrators et propriétaire root conservés. Les tests sous app-dev indiquent lecture et écriture NON sur le parent et .env.production. Aucune correction récursive n’a été demandée. Ces preuves valident la restriction par le chemin testé, sans démontrer l’absence de tout autre chemin ou montage.

Dernier relevé transmis : suivi-cb-backend et suivi-cb-frontend running/healthy. /volume1/suivi-cb-backups et ses scripts backup-daily.sh et publish-backups.sh appartiennent à root:root en mode Linux 0700, sans ACL DSM supplémentaire. Le coffre SuiviCB-BackupVault appartient à root et accorde une ACL au seul groupe administrators. Son sous-dossier published appartient à root:root en mode Linux 0700. Contrôles production et sauvegardes validés dans cette portée ; les accès administratifs restent privilégiés par conception. L’identité UID 1028 partagée entre application et administrateur est documentée et ne confère pas à elle seule sudo ou les groupes supplémentaires au conteneur.

### Préproduction et héritage vérifiés

Relevé utilisateur : /volume1/docker/suivi-cb-preprod appartient à GodOfNasAugerie (UID 1028, GID 100), avec ACL ContainerManager, administrators, propriétaire et entrée explicite GodOfNasAugerie. Le dossier recette-2.2.0-rc.8 appartient à root et hérite des entrées ContainerManager, administrators, propriétaire et root. Aucune entrée developers, app-dev ou users ne figure dans ces ACL. Le sous-dossier data est en mode Linux 0700, UID 1028/GID 100, sans ACL DSM supplémentaire. Ces droits sont cohérents avec les besoins de recette et valident les métadonnées et l’héritage des chemins contrôlés ; aucun test d’accès effectif sous app-dev n’a été fourni pour ces chemins de préproduction, contrairement à la production. Aucun changement de droits supplémentaire nécessaire sur la base de ce relevé.

### Politique Actions et PR de durcissement

Mise à jour finale : PR #5 relue et fusionnée par l’utilisateur. Vérification API : merged=true, state=closed, fusion bcd3a417c87c04f25d090814db56e6d62aada42b. Le fichier sur master correspond au blob attendu 41c32fc2c023e39221469389a46f49c74834a5c0. Le durcissement est intégré ; la mention de PR non fusionnée ci-dessous décrit l’état lors de son ouverture. Aucun tag ni déploiement effectué par l’agent.

L’utilisateur confirme les paramètres Actions enregistrés. La capture porte le bandeau Actions policy updated et montre les actions sélectionnées, les actions créées par GitHub autorisées et les créateurs Marketplace décochés. L’exigence globale de SHA est encore décochée. Les permissions par défaut du jeton ne figurent pas dans cette capture ; leur enregistrement est déclaré par l’utilisateur et n’a pas pu être relu via l’API administrative.

Sur autorisation explicite, branche security/harden-release-workflow-20261015 créée depuis master, puis commit 6ffe8c5c973c221c80475613a258b59f1beb3db6 ne modifiant que .github/workflows/publish-github-release.yml. PR ouverte : https://github.com/Djone/suivi-cb/pull/5 (un commit, un fichier, +10/-2), vers master, non fusionnée. Vérifications locales YAML, permissions, SHA, concurrence et syntaxe JavaScript réussies. Le workflow ne se déclenche que sur tags ; aucune création de tag, publication de release ni exécution NAS effectuée. La fusion et la vérification du fichier sur master restent à réaliser.

Le durcissement du workflow n’affecte pas les images RC8 déjà qualifiées. Aucune publication, approbation de release ou MEP n’est engagée.
