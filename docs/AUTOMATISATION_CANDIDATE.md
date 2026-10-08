# Construire, exporter et transférer une candidate

Parcours : Dev → tests dev → commit candidat → package et transfert →
installation et tests préproduction → approbation → publication Git → MEP.

La commande ci-dessous automatise les tests, les deux constructions Docker,
l’export, l’inspection de l’archive, le manifeste et le transfert vérifié au NAS.
Elle s’arrête avant l’installation en préproduction. La publication Git et la MEP
restent des actions distinctes ; aucun appel à update.sh n’est effectué.

## 1. PC, terminal PowerShell : préparer

Prérequis : Node, dépendances backend/frontend installées, Chrome pour les tests,
Docker Desktop en mode Linux, Git et OpenSSH. Utiliser le commit créé par prepare,
avec un dépôt propre : fichiers modifiés et non suivis sont refusés. Faire relire
et commiter les changements voulus avant de lancer la construction, sans secrets
ni anciennes archives. La commande ne crée pas de commit et ne pousse pas Git.

Sous PowerShell Windows, employer npm.cmd : le lanceur npm.ps1 installé ici perd
les arguments après --. Sous Linux/macOS, utiliser npm à la place de npm.cmd.

Dans release-process, le panneau « Package de préproduction » propose automatiquement
le prochain numéro pour la version stable saisie. Il prend le plus grand numéro
trouvé dans les dossiers .cache/releases, les fichiers locaux et les tags Docker
de préproduction, puis ajoute 1. Les anciens noms rc2 et les nouveaux rc.2 sont
reconnus ; un dossier de construction échouée réserve aussi son numéro. Utiliser
« Actualiser la prochaine candidate » après une construction lancée dans le terminal.
Si Docker est indisponible, l’interface le signale. Le NAS distant n’est pas interrogé :
le refus d’écrasement pendant le transfert protège aussi les candidates présentes
uniquement sur le NAS. Le numéro affiché est une proposition, pas une réservation.

La candidate proposée utilise le format 2.2.0-rc.3. Le point avant le numéro est
volontaire (prérelease SemVer) ; les anciens tags 2.2.0-rc2 ne sont pas modifiés.
Chaque construction utilise un nouveau numéro, même après un échec partiel.

~~~powershell
Set-Location 'C:\Users\jonat\OneDrive\suivi-cb'
# Simulation, sans construction ni connexion NAS :
npm.cmd run release:candidate -- --candidate=2.2.0-rc.3 --platform=linux/amd64
# Exécution, après préparation du commit :
npm.cmd run release:candidate -- --candidate=2.2.0-rc.3 --platform=linux/amd64 --execute
~~~

Architecture NAS : uname -m = x86_64 → linux/amd64 ; aarch64 → linux/arm64.
Les tests backend, frontend, le build frontend production et les audits npm
production doivent réussir ; aucun paramètre ne permet de les ignorer.

Les valeurs NAS par défaut sont GodOfNasAugerie@192.168.1.113, port 1122,
dossier /volume1/docker/suivi-cb-preprod/releases. Elles sont personnalisables :

~~~powershell
npm.cmd run release:candidate -- --candidate=2.2.0-rc.3 --host=192.168.1.113 --user=GodOfNasAugerie --port=1122 --remote-root=/volume1/docker/suivi-cb-preprod/releases --execute
~~~

Le terminal peut demander plusieurs fois le mot de passe SSH. Ne pas fermer la
fenêtre. L’authentification par clé évite ces demandes si elle est déjà configurée ;
aucune modification de SSH n’est requise et aucun mot de passe n’est enregistré.
SCP utilise -O car le sous-système SFTP du NAS n’est pas disponible ici.
Les boutons HTTP de l’assistant ne lancent pas cette commande interactive.

## 2. Résultats et reprise

Sur le PC : .cache/releases/2.2.0-rc.3/. Sur le NAS :
/volume1/docker/suivi-cb-preprod/releases/2.2.0-rc.3/.

| Fichier | Contenu |
| --- | --- |
| images.tar | Les deux images construites une seule fois |
| manifest.json | Commit, IDs des images, architecture et empreinte du tar |
| docker-compose.yml | Pile préprod épinglée aux IDs, sans build |
| inspection.json | Inspection des couches : données sensibles et cohérence des sources/Nginx |
| SHA256SUMS | Empreintes des quatre fichiers vérifiées sur le NAS |

Un dossier local ou un tag existant interdit une nouvelle construction. Une
candidate déjà présente sur le NAS interdit son remplacement. Le transfert passe
par un dossier temporaire protégé et un verrou ; le nom final apparaît seulement
après vérification des empreintes. Le dossier temporaire d’un transfert échoué
reste disponible pour diagnostic, sans être considéré comme une candidate installée.

Si seule la connexion/transmission échoue, reprendre sans reconstruire :

~~~powershell
npm.cmd run release:candidate:transfer -- --candidate=2.2.0-rc.3 --execute
~~~

Le package local est vérifié avant toute connexion. S’il est modifié, le transfert
est refusé. Si un verrou .upload-lock reste après une interruption brutale,
vérifier qu’aucun transfert n’est actif avant de le retirer sur le NAS avec rmdir.
Ne pas supprimer ni écraser une candidate déjà validée.

## 3. NAS : installer et tester en préproduction

Suivre les étapes de sauvegarde/import/bascule de
[CHECKLIST_RC2_PREPRODUCTION.md](./CHECKLIST_RC2_PREPRODUCTION.md), en remplaçant
le dossier et les tags par la nouvelle candidate. L’archive s’appelle ici images.tar.
Charger cette archive avec docker load, puis installer le Compose fourni dans
le dossier racine /volume1/docker/suivi-cb-preprod, avec ses .env.preprod, data et
logs existants. Ne pas lancer Compose depuis le dossier releases : ses volumes
relatifs pointeraient au mauvais endroit. Ne pas copier de données de production.

Le Compose utilise directement les IDs du manifeste ; ne pas les remplacer par
des images reconstruites. Exécuter les contrôles du
[guide de vérification](./VERIFICATIONS_RC2_GUIDE.md) et conserver un compte rendu
sans jetons, secrets ou données personnelles. L’inspection de l’archive et les
audits npm ne remplacent ni le scan des images ni les tests NAS.

## 4. Approbation explicite, sur le PC

Après les essais, relever sur le NAS les IDs réellement testés :

~~~sh
sudo docker inspect --format '{{.Name}} {{.Image}}' suivi-cb-preprod-backend suivi-cb-preprod-frontend
~~~

Sur le PC, sauvegarder le compte rendu puis saisir les deux IDs relevés :

~~~powershell
$BackendId = Read-Host 'ID sha256 du backend valide sur le NAS'
$FrontendId = Read-Host 'ID sha256 du frontend valide sur le NAS'
$Approver = Read-Host 'Nom de la personne qui approuve'
$Evidence = Read-Host 'Chemin du compte rendu des tests'
# Cette commande constitue votre approbation explicite de la promotion :
npm.cmd run release:candidate:approve -- --candidate=2.2.0-rc.3 "--backend-id=$BackendId" "--frontend-id=$FrontendId" "--approved-by=$Approver" "--evidence=$Evidence" --execute
~~~

Un ID différent du manifeste est refusé. approval.json lie le commit, les images,
le tar et les empreintes du manifeste/compte rendu à l’approbateur et à la date.
Il ne peut pas être écrasé. Il s’agit d’une attestation opérateur locale, sans
signature cryptographique ni interrogation automatique des tests sur le NAS.
Conserver ensemble le package, le compte rendu et cette approbation.

Publier ensuite Git via l’assistant et suivre
[PROMOTION_PREPROD_PRODUCTION.md](./PROMOTION_PREPROD_PRODUCTION.md) pour les
sauvegardes et la promotion des mêmes images avec les données/configurations de
production. Vérifier approval.json avant la bascule. La commande approve n’effectue
aucune installation ; le garde-fou ne verrouille pas des commandes Docker manuelles.

## Validation de l’automatisation

~~~powershell
npm.cmd run test:candidate
~~~

Les tests simulent Docker et SSH : contrôles en échec, dépôt sale, intégrité,
transfert/reprise et approbation d’images différentes. Ils ne valident pas une
connexion réelle au NAS ni la candidate elle-même.
