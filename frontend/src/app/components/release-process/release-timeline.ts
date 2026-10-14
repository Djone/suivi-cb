import { ReleaseCommand } from '../../services/release-process.service';
export interface ReleaseTask { id: string; label: string; note: string; command?: ReleaseCommand }
export interface ReleasePhase { id: string; environment: string; title: string; description: string; tasks: ReleaseTask[] }
export const RELEASE_PHASES: ReleasePhase[] = [
  {
    id: 'development', environment: 'Développement', title: 'Terminer la version', description: 'Stabiliser le périmètre avant de préparer la release.', tasks: [
      { id: 'dev-changes', label: 'Tous les changements sont intégrés', note: 'Périmètre figé, tickets livrés et notes de release relus.' },
      { id: 'dev-tests', label: 'Les tests fonctionnels passent', note: 'Parcours critiques et migrations vérifiés en développement.' },
    ]
  },
  {
    id: 'controls', environment: 'Contrôles dev', title: 'Vérifier et préparer', description: 'Exécuter les contrôles Git et préparer les versions avec les commandes existantes.', tasks: [
      { id: 'controls-dry-run', label: 'Dry-run exécuté sans erreur', note: 'Contrôle automatique : résultat réel du backend.', command: 'dry-run' },
      { id: 'controls-prepare', label: 'Préparation exécutée sans erreur', note: 'Contrôle automatique : versions et notes préparées selon les options.', command: 'prepare' },
    ]
  },
  {
    id: 'candidate', environment: 'Candidat', title: 'Construire le package', description: 'Construire une seule fois depuis le commit préparé, puis transférer le package au NAS.', tasks: [
      { id: 'candidate-source', label: 'Commit de préparation relu et poussé', note: 'Dépôt propre ; le push reste une opération de l’utilisateur.' },
      { id: 'candidate-package', label: 'Images du candidat construites et transférées', note: 'Commande automatisée au terminal du PC ; vérifier son résultat avant de cocher.' },
      { id: 'candidate-ids', label: 'Commit et identifiants des images consignés', note: 'Backend, frontend et empreinte du package enregistrés dans le rapport.' },
    ]
  },
  {
    id: 'preproduction', environment: 'Préproduction', title: 'Déployer et approuver', description: 'Tester exactement les images qui seront promues en production.', tasks: [
      { id: 'preprod-deploy', label: 'Candidat installé en préproduction', note: 'Opération NAS manuelle, sans reconstruction.' },
      { id: 'preprod-approval', label: 'Recette terminée et candidat approuvé', note: 'Validation manuelle obligatoire ; consigner les IDs exacts et l’approbation.' },
    ]
  },
  {
    id: 'git-publication', environment: 'Publication Git', title: 'Publier la release', description: 'Après le feu vert préproduction, fusionner et publier le tag Git.', tasks: [
      { id: 'git-publish', label: 'Branche cible publiée et tag créé', note: 'Contrôle automatique : deploy publie Git, sans déployer sur le NAS.', command: 'deploy' },
      { id: 'git-next', label: 'Cycle de développement suivant vérifié', note: 'Vérifier la prochaine version et la branche selon les options choisies.' },
    ]
  },
  {
    id: 'production', environment: 'Production', title: 'Promouvoir et clôturer', description: 'Promouvoir les mêmes images approuvées, avec les données et variables de production.', tasks: [
      { id: 'production-deploy', label: 'Images préproduction promues en production', note: 'Opération NAS manuelle ; comparer les IDs, sans rebuild ni update.sh.' },
      { id: 'production-smoke', label: 'Smoke tests validés et rapport archivé', note: 'Contrôles de version, sauvegardes et compte rendu de release conservés.' },
    ]
  },
];
