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

## Importer les preuves reelles

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

Un checksum local n'authentifie pas GitHub. L'origine est explicitement marquee
local-checksummed-import et authenticatedGithubProvenance=false. La revue de
provenance est une attestation humaine, jamais une verification automatique.
La recuperation authentifiee automatique reste au lot 2. Aucun identifiant
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
