# Contrôles finaux de sécurisation

L’approbation et la MEP restent exclues des actions en cours, à la demande de l’utilisateur.

## Candidate RC8

Construite depuis `b7d52fe659344dcd47d15cba69c17ad21187ba39`. Package local : `.cache/releases/2.2.0-rc.8`. Tests backend et frontend, builds et audits des dépendances de production réussis. Scans Trivy des deux images : aucune vulnérabilité ni secret détecté. Exercices Docker de migration/rollback et démarrage non privilégié avec seuil de ports privilégiés 1024 réussis, y compris avec 192 Mio backend et 64 Mio frontend.

Le script `install-recette.sh` du package a été vérifié syntaxiquement ; ses opérations NAS n’ont pas été exécutées par l’agent. Il vérifie les empreintes, importe les images, prépare une copie de la sauvegarde du 14 octobre et remplace seulement les conteneurs de recette RC7 par RC8 sur le port hôte 4201. Les données de recette RC7 restent conservées dans leur dossier ; elles ne sont pas reprises dans RC8. Une interruption de recette est attendue pendant le remplacement. Le script refuse les dossiers ou conteneurs RC8 déjà présents ; ne pas le relancer après un échec sans diagnostic.

À vérifier sur NAS : santé, version RC8 et HTTP 200/401 ; utilisateur sans rôle dirigé vers Accès non autorisé sans chargement métier ; déconnexion accessible ; compte autorisé et parcours métier concernés. Le refus backend 403 a été prouvé sur RC7 ; le garde RC8 peut empêcher tout appel API du compte sans rôle, ce qui est attendu. Un test direct de l’API reste nécessaire pour attester le 403 sur RC8.

## Droits GitHub : relevé du 15 octobre

Lecture de l’API publique GitHub : `master` et `2.2.0-dev` non protégées, liste des rulesets vide. Aucun réglage distant modifié. Le workflow local `publish-github-release.yml` publie sur tags stables, utilise `contents: write` et déplace le tag majeur avec `force: true` ; il ne constitue pas un contrôle qualité et ne doit pas être déclenché pendant cette phase.

À configurer avec le compte administrateur : protéger les deux branches, imposer une PR, résoudre les conversations, interdire force-push et suppression et limiter les exceptions. Définir une revue indépendante si un second mainteneur est disponible ; ne pas déclarer une auto-approbation comme revue indépendante. N’exiger aucun nom de check fictif avant la mise en place et une exécution réelle de la CI prévue en 2.3.0. Vérifier les permissions Actions par défaut en lecture, les accès d’écriture nécessaires uniquement au job de publication, les actions autorisées et le verrouillage des actions tierces sur un commit vérifié. Les protections effectives doivent être relues après configuration.

## Rétention et surveillance : relevés préalables NAS

Commandes en lecture seule à exécuter après la recette RC8 :

```sh
sudo sh <<'SH'
set -eu
for ROOT in /volume1/suivi-cb-backups /volume1/SuiviCB-BackupVault/published; do
  printf '\nROOT=%s\n' "$ROOT"
  test -d "$ROOT"
  for RUN in "$ROOT"/run-*; do
    test -d "$RUN" || continue
    test ! -L "$RUN" || exit 1
    printf '%s ' "${RUN##*/}"
    if test -f "$RUN/status.txt"; then cat "$RUN/status.txt"; else echo MISSING_STATUS; fi
  done
done
for PATHNAME in /volume1/docker/suivi-cb /volume1/docker/suivi-cb-preprod /volume1/suivi-cb-backups /volume1/SuiviCB-BackupVault /volume1/SuiviCB-BackupVault/published; do
  ls -ldn "$PATHNAME"
  /usr/syno/bin/synoacltool -get "$PATHNAME"
done
df -h /volume1 /volumeUSB1/usbshare
SH
```

Compléter par la date et le statut du dernier succès de la bonne tâche Hyper Backup dans DSM, et sa dernière vérification d’intégrité. La date de modification du fichier `.hbk` n’est pas une preuve de succès. Identifier une source de statut exploitable avant d’automatiser une alerte de copie externe trop ancienne.

La politique locale reste à définir et simuler sur les sources et les copies publiées, en coordination avec la publication qui republie actuellement tous les runs sources. Tester sur données synthétiques les exclusions, sauvegardes incomplètes, liens, concurrence et dernière sauvegarde conservée avant toute suppression réelle. La rétention Hyper Backup ne nettoie pas les sources. Conserver les preuves de restauration antérieures ; planifier un nouvel exercice USB sur un run récent et mesurer la reprise, sans modifier la production. Ne pas considérer ces points comme validés avant les essais.
