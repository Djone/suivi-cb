# Exécuteur DSM de préproduction — 2.2.0

Le kit relie la page locale /release-process à une tâche DSM root, sans runner GitHub sur le NAS et sans règle sudoers. La clé SSH transmet uniquement une demande JSON bornée et consulte un reçu. Aucun code de demande n'est exécuté. Aucune action de production n'est implémentée.

## Installation initiale

1. Dans /release-process, télécharger le kit DSM. Le backend local doit être redémarré pour charger les nouvelles routes.
2. Transférer dsm-executor.tar.gz vers le dossier personnel NAS via File Station, puis extraire le dossier dsm-executor.
3. Relire le kit et lancer dans la session SSH administrateur :

```sh
sudo sh "$HOME/dsm-executor/install-dsm-executor.sh"
```

Attendre DSM_EXECUTOR_INSTALLED_PLAN_ONLY. Les empreintes sont vérifiées avant installation. Le script ne remplace que le point d'entrée SSH de diagnostic dont l'empreinte est connue. Une installation existante ou inattendue est refusée ; ne pas supprimer ses répertoires pour forcer une réinstallation.

4. Dans le Planificateur de tâches DSM, créer une tâche de script utilisateur avec le compte root et une fréquence disponible de 1 à 5 minutes. Conserver les journaux. Commande :

```sh
sh /volume1/docker/suivi-cb-deployment-control/code/deploy-controller/dsm-worker.sh
```

Sans demande, la tâche sort sans lancer de conteneur ni modifier de service. Le bouton Exécuter de DSM permet de vérifier ce premier passage.

5. Tester SSH dans la page. La détection de la file confirme seulement sa disponibilité SSH ; seul un reçu de plan confirme l'exécution du travail DSM.

## Première demande de plan

Créer/importer une candidate CI, figer son périmètre et attester la revue des sources. Transférer et préparer son kit NAS suivant le guide de release. Les images, le manifeste, l'approbation et l'environnement préproduction doivent être présents sous le répertoire de contrôle root. La tâche ne télécharge pas encore les packages ni les images depuis GHCR.

Cliquer Demander le plan DSM. Attendre PLAN_PASS, puis exporter le dossier de preuves. Les champs candidate, commit et archive SHA-256 du reçu doivent correspondre au dossier. Un envoi réussi n'est pas un déploiement réussi.

## Barrières d'exécution

- Seules les actions plan et apply-preproduction existent ; aucune commande libre, chemin de script ou environnement de production n'est accepté.
- Demandes de 8 Kio maximum, champs stricts, nonce UUID et validité de 15 minutes. Un seul travail peut attendre.
- L'identité doit correspondre au manifeste et à l'approbation installés par root. La demande est copiée dans un fichier root privé, puis validée dans un conteneur sans réseau, sans socket Docker et sans capacités. Les chemins du contrôleur sont fixes.
- Le contrôleur revérifie le manifeste sous verrou contre l'empreinte attendue. Un changement de configuration ou de code invalide le plan conservé sur le NAS.
- Une demande commencée n'est jamais relancée automatiquement après interruption. Les marqueurs et reçus root sont conservés ; un reçu ne peut pas être écrasé.
- L'application exige un plan de cette candidate, une confirmation dans la page et deux activations root distinctes du contrôleur/DSM. L'installateur ne crée aucune activation. Ces activations restent à qualifier sur NAS avant utilisation ; aucune commande d'activation n'est fournie dans cette phase.
- Le contrôleur conserve les données existantes, effectue son snapshot SQLite avant migration et ne reconstruit pas les images. Il ne touche pas aux conteneurs de production ou à Keycloak.

## Suivi et incidents

La page permet de retrouver la dernière demande après rechargement. Ses reçus vérifiés sont enregistrés avec la candidate dans le dossier, sans cocher les validations humaines. Les résultats PLAN_PASS et PREPRODUCTION_SMOKE_PASS sont des preuves techniques uniquement.

Si la livraison SSH est ambiguë, consulter le reçu avant toute nouvelle tentative. Une demande invalide, expirée ou interrompue reste bloquée pour inspection : consulter les journaux DSM, le verrou et le marqueur de démarrage. Ne pas effacer automatiquement les preuves, relancer une application ou restaurer une base. Une reprise doit tenir compte des conteneurs et des écritures réellement présents.

## Validation disponible

Les tests JSON/HTTP locaux et l'exercice Docker isolé couvrent le plan, l'interdiction de production, l'application désactivée, les commandes SSH restreintes, le rejeu, l'interruption, l'expiration et le changement de manifeste. L'exercice Docker n'a aucun socket hôte ni montage de production. Il utilise un substitut pour le lancement du conteneur de validation et pour les services applicatifs ; il ne valide pas une migration ou un déploiement réel sur NAS.

L'installation DSM réelle, le premier PLAN_PASS NAS, l'activation préproduction et la recette finale restent à valider. La publication GHCR et la promotion production ne sont pas achevées par ce kit.
