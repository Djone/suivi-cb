# Lot 3 : dossier de preuves dans /release-process

## Objectif et limites

Le dossier persistant pilote la preparation de la candidate 2.2.0. Il ne publie
ni tag, ni release, ni image et ne deploie aucun service. Les publications restent
bloquees a la demande du mainteneur, y compris par appel direct de l'API.
La recette NAS est conservee pour la fin du lot 2. Une preuve RC7/RC8 ne valide
pas automatiquement une nouvelle candidate.

L'ancien parcours a cases reste replie comme reperes de session. Il ne cloture
plus la release. Dry-run et preparation des fichiers de versions restent des
commandes explicites distinctes ; toute modification des sources impose une
nouvelle candidate et une nouvelle qualification.

## Parcours principal pour le responsable de release

La page presente sept etapes : Git, candidate, transfert NAS, recette, approbation,
production et cloture. Chaque commande indique ou la lancer et son resultat attendu.
Le bouton de creation reutilise la candidate deja construite par la CI du commit
pousse : aucune deuxieme construction. Il exige un depot propre, la branche
protegee master ou 2.2.0-dev, le meme commit local/distant et les trois jobs reels
Quality, Docker and browser qualification et Required CI tous reussis.

Le backend utilise en memoire la connexion GitHub deja configuree dans Git
Credential Manager. Aucun jeton a saisir dans la page ou a sauvegarder dans le
dossier. Les appels GitHub sont en lecture seule : ni push, ni workflow declenche,
ni publication. Le telechargement suit seulement une redirection HTTPS de stockage
autorisee, sans transmettre le credential GitHub a ce stockage. Le ZIP est verifie
avec le digest de l’API puis extrait avec taille/noms limites, sans liens, doublons
ou chemins traversants. Cette voie marque authenticatedGithubProvenance=true.
L’import manuel de secours ci-dessous reste explicitement non authentifie.

La preparation est suivie dans la page et persiste dans .cache/ci/candidate-flow.json.
Un backend redemarre signale une operation interrompue ; un nouvel essai reverifie
Git, la CI et les empreintes et ne remplace pas un staging conflictuel.

## Kit NAS de preproduction

Apres perimetre fige et revue humaine des sources, le bouton de kit demande une
confirmation explicite et fournit nas-kit-CANDIDATE.tar.gz. Il contient le code
revu du controleur, les empreintes, la configuration preprod sans secret et une
autorisation locale de deploiement preproduction. Cette autorisation ne remplace
pas les approbations des environnements GitHub ni la recette apres deploiement.
Le kit et le ZIP sont a extraire cote NAS dans le meme dossier de release, en
respectant les deux sous-dossiers nas-kit et candidate-RUN affiches dans la page.

prepare-preproduction.sh verifie les empreintes, prepare un controle prive root,
archive l’ancien incoming et valide le plan sans changer de service.
apply-preproduction.sh est une action explicite dans la session SSH NAS : active
temporairement le seul controleur preproduction, puis retire son drapeau.
Le controleur et la preparation partagent un verrou. La production et Keycloak
ne sont pas arretes. Le port de cette pile est 127.0.0.1:4205 ; verifier le proxy
et le numero de version avant recette. L’ancienne recette RC8 utilisait 4201.

Le kit inclut test-rollback.sh : ancienne image effectivement installee sur le
NAS, migration vers la candidate, ecriture dans accounts, retour a l’ancienne
image puis reprise de la candidate. Un volume et un reseau internes etiquetes
sont crees et nettoyes ; aucun bind de donnees NAS ni port ni socket Docker.
Seule la lecture de l’identite de l’image de production est effectuee. Ce script
doit encore etre valide sur NAS ; un resultat CI ne remplace pas cet exercice.

check-backup.sh controle en lecture seule le dernier run (sans revenir a un ancien
succes si le dernier a echoue), ses empreintes et la copie published du meme run.
La verification USB reste manuelle dans Hyper Backup. Les commandes de production
sont decrites pour preparer la MEP supervisee ; aucun lancement de production
n’est active. La premiere bascule depuis les conteneurs individuels reste a
qualifier avec le mainteneur.

## Import manuel des preuves reelles (secours)

1. Telecharger l'artefact candidate-RUN depuis une execution GitHub reussie et
   controler son origine et son empreinte d'artefact dans GitHub.
2. Extraire son contenu dans .cache/ci/github-run-RUN/candidate-RUN/ a la racine
   du depot. Conserver les noms plats et SHA256SUMS. Inclure images.tar.
   Aucun fichier de cet artefact n'est execute par l'importeur.
3. Dans /release-process, choisir Artefact GitHub extrait, saisir RUN et importer.
   Le choix Package CI local lit exclusivement .cache/ci/package/.
4. Comparer la candidate, le commit teste, les identites de configuration des
   images et le SHA-256 de l'archive. Le commit de fusion teste par une PR peut
   differer du commit de tete de la branche : ne pas les confondre.
5. Renseigner le perimetre et les notes, puis attester leur revue et la provenance.
   Un depot modifie ou ne correspondant pas au commit teste reste bloquant.

L'importeur verifie l'inventaire, les fichiers ordinaires et leurs empreintes,
le manifeste et les rapports qualite, API/navigateur, nettoyage, Keycloak,
migrations/rollback, inspection, scans et SBOM. Il n'importe pas les journaux
bruts ni les valeurs de secrets detectes. Les champs inconnus du manifeste
ne sont pas conserves. Des metadonnees sans images.tar sont consultables,
mais l'integrite complete et le passage en preproduction restent bloques.

Pour cet import manuel de secours, un checksum local n'authentifie pas GitHub.
L'origine conserve authenticatedGithubProvenance=false : sa provenance reste
une attestation humaine. La voie automatique, elle, authentifie les appels GitHub
et verifie le digest de l'artefact avant l'extraction et l'import.
La voie automatique de la page verifie aussi le digest de l’artefact fourni par GitHub. Aucun identifiant
GitHub ou NAS n'est demande ni stocke par ce dossier.

## Validations et invalidation

Les resultats importes sont distingues des declarations humaines. Les controles
NAS couvrent identite/architecture, 401/403/200, audiences, refresh, OTP, logout,
acces refuse, parcours metier, migrations/rollback, sauvegarde/restauration et
droits. Une reference de compte rendu est obligatoire. La confirmation stocke
l'identifiant utilisateur authentifie, la date et l'identite de la candidate.
Les anciens comptes rendus peuvent servir de contexte, pas de recette actuelle.

L'identite associe version, commit, archive, images et references de registre.
Changer de candidate ou de contenu de preuves invalide toutes les attestations
et archive le dossier precedent. Modifier le perimetre efface les attestations.
Retirer un controle retire aussi l'approbation preproduction et les validations
production. Une revision optimiste empeche un onglet ancien d'ecraser une mise
a jour recente ; actualiser apres STALE_DOSSIER. Les fichiers du dossier sont
reserves a l'instance locale unique du backend, sans coordination multi-processus.

L'approbation preproduction exige les autres controles NAS. Les validations
production exigent les prerequis et la politique de publication. Le verrou
actuel empeche de les confirmer et empeche la cloture, meme si des cases de
l'ancien parcours sont cochees. Les traces humaines ne remplacent pas les
approbations des environnements GitHub.

## Reserves et archivage

L'exception braces est lue depuis docs/audit/2026-10-15/dependency-risk-acceptance.json.
La plus proche des echeances du manifeste et de la politique courante s'applique,
sans prolongation automatique. Refus si politique manquante, non acceptee ou
expiree. Elle est affichee comme risque accepte, jamais comme faille corrigee.
La retention 7 quotidiennes/4 hebdomadaires et l'alerte USB de 36 heures sont
consignees en report 2.3.0 vers le 15/11, sans validation implicite.

Le backend conserve data/release/evidence/current.json par remplacement atomique,
chaque revision remplacee dans history/ et chaque export horodate dans reports/.
Exporter et archiver le rapport JSON enregistre une photographie des controles
et blocages puis la telecharge. Le rapport porte explicitement le type
release-readiness-not-deployment-authorization. Il n'accorde aucune autorisation
de livraison. Ces fichiers locaux doivent etre inclus dans l'archivage de release.
Ne pas mettre de secrets ou donnees bancaires dans les notes/references ; les
formes usuelles de JWT et de cle privee y sont refusees.

## API locale et validation

Les routes /api/release/evidence restent sous authentification existante et
controle du socket loopback ; elles ne sont pas montees en production.
GET / lit le dossier ; POST /import importe un staging fixe ; POST / met a jour
perimetre ou attestation avec identity et revision ; POST /report archive et
retourne le rapport. GET /report le consulte sans ecriture. Aucun chemin libre,
commande shell ou changement de politique n'est accepte par ces nouvelles routes.

Les tests utilisent des archives synthetiques et des dossiers temporaires.
Ils couvrent persistance, alteration, archive manquante, liens, source et image
incoherentes, expiration, revision obsolete, invalidation, approbations, verrou
publication, export et absence de sauvegarde de secrets. Les tests Angular
couvrent affichage, identite, confirmation explicite et cloture bloquee.
La lecture des vrais rapports GitHub historiques est egalement exercee localement ;
une archive manquante y reste correctement signalee.

Apres changement du backend Node local, le redemarrer pour charger les nouvelles
routes. Cette installation de developpement n'intervient pas sur le NAS.
La validation bout en bout de la candidate finale et la cloture effective restent
attendues apres les controles des lots 2 et 4.

Validation locale du 20/10 : 14 tests dedies backend, 108 tests frontend,
lint, TypeScript et build de production reussis. Les tests incluent une panne
de remplacement atomique et sa reprise, ainsi que deux imports concurrents.
Le cycle GitHub du commit de cette implementation reste la preuve de candidate.

Validation du parcours guide : 122 tests backend et 114 tests frontend,
controle de syntaxe de tous les scripts NAS, lecture reelle de l’API GitHub et
extraction d’un vrai artefact verifies localement. Les scripts NAS sont fournis
pour execution explicite sur le NAS ; ils ne sont pas installes depuis le PC.


### Transfert Windows avec SSH par mot de passe

Le kit contient `transfer-to-nas.ps1`, exécuté sur le PC après extraction du kit dans le même dossier que `candidate-RUN.zip`. Le ZIP doit provenir de la récupération GitHub authentifiée : son empreinte est incorporée au script. OpenSSH demande le mot de passe directement dans le terminal, sans stockage dans l’application. Le script vérifie les empreintes, refuse un dossier distant existant, transfère une archive puis vérifie les fichiers sur le NAS. `NAS_TRANSFER_OK` confirme uniquement le transfert. Aucun service ne démarre. Le dossier parent `releases` doit être accessible au compte NAS. Les clés d’hôte doivent déjà être vérifiées ; aucune protection SSH ou politique Windows ne doit être désactivée. File Station reste la solution de secours. Un transfert interrompu laisse le dossier NAS en place pour inspection, sans suppression automatique.

Validation locale : syntaxe PowerShell et génération du kit testées. Le transfert interactif et la recette NAS restent à exécuter sur l’installation cible.


### Cycle de version suivant

Le dossier de preuves contient désormais le champ « Version de développement suivante », par exemple `2.3.0-dev`. Le backend impose une version strictement supérieure à la version stable de la candidate. Ce choix persiste avec son identité et figure dans le rapport ; un changement invalide les validations de production. Les preuves de recette restent conservées. La réimportation de la même candidate conserve ce plan, une nouvelle candidate le réinitialise.

L’approbation MEP porte sur ce plan, mais ne modifie pas les versions des images construites. Le passage des sources et de la branche de développement au cycle suivant doit se faire après la MEP et les contrôles de production, à la clôture. L’application automatique de ce changement reste à raccorder au moteur de clôture lorsque les publications seront explicitement activées. Aucune modification de package.json, des environnements ou des notes de release n’est déclenchée par l’enregistrement du plan.


### Accès SSH par clé : installation initiale

Le 20/10/2026, le mainteneur a autorisé l’approbation manuelle de ses propres demandes GitHub et la préparation d’une clé SSH dédiée. Les environnements `candidate-registry`, `preproduction` et `production` du dépôt public conservent un reviewer Djone, les branches protégées uniquement et `can_admins_bypass=false`, avec `prevent_self_review=false`. Ce choix permet une approbation manuelle individuelle ; il ne constitue pas une revue indépendante.

La page permet de générer/réutiliser la clé locale, télécharger l’installateur public et tester la connexion. La clé privée reste sous `data/release/ssh`, ignoré par Git, avec des droits locaux restreints. Ne pas la copier dans GitHub, le navigateur ou les rapports.

L’installation initiale a été adaptée au NAS : ni getent ni visudo ne sont disponibles. Le script final utilise awk et /etc/passwd et ne modifie aucun sudoers. Il installe uniquement une commande forcée de diagnostic. Les autres clés sont conservées ; le shell libre, le forwarding, le PTY, le transfert et le déploiement sont interdits pour cette clé. Une installation existante n’est jamais remplacée automatiquement.

Le 20/10/2026, l’opérateur a confirmé `SSH_KEY_INSTALLED_PROBE_ONLY`. Le PC a ensuite vérifié la connexion réelle en BatchMode avec StrictHostKeyChecking=yes, sans mot de passe. Les commandes `id`, `suivi-cb-plan` et `suivi-cb-apply` ont toutes été refusées, comme prévu. Aucun privilège root supplémentaire n’a été accordé.

La vérification du plan a son contrat backend (candidate, commit et run identiques au dossier), mais reste inactive tant que l’exécuteur NAS n’est pas installé et qualifié. Les transferts et l’application préproduction restent sur le kit existant. Aucun nouveau déploiement, push GHCR, tag ou release n’a été effectué. La promotion production et le changement automatique de cycle restent à qualifier.
