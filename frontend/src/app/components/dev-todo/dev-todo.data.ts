import { DevTodoItem } from './dev-todo.model';

export const DEV_TODO_ITEMS: DevTodoItem[] = [
  {
    title: 'Automatisation des MEP : tests et livraison avec GitHub Actions',
    description: [
      '[ ] Développement local : code et Docker Compose, avec données de test isolées',
      '[ ] Git push / Pull Request : revue obligatoire et contrôles requis sur la branche cible',
      '[ ] Pipeline CI : vérification du code, TypeScript, lint et tests unitaires backend/frontend',
      '[ ] Tests d’intégration Docker : authentification Keycloak, permissions API, migrations et parcours critiques',
      '[ ] Contrôles de sécurité : dépendances, secrets, images système et traitement documenté des alertes',
      '[ ] Construire une seule fois les images du candidat depuis le commit retenu ; toute correction produit un nouveau candidat',
      '[ ] Publier dans GHCR : images versionnées par digest SHA-256, manifeste, SBOM et preuves de construction ; valider la compatibilité Synology',
      '[ ] Déployer les images exactes en préproduction Synology via un exécuteur local contrôlé, sans reconstruction',
      '[ ] Recette préproduction : smoke tests, migrations, restauration et rollback applicatif ; rapport persistant lié aux digests',
      '[ ] Approbation humaine explicite du candidat testé avant promotion en production',
      '[ ] Production : sauvegarde SQLite cohérente puis promotion des mêmes digests, sans rebuild ni redémarrage de Keycloak',
      '[ ] Contrôles après MEP : santé, version, parcours critiques et rapport traçable ; rollback compatible sans restauration automatique des données',
      '[ ] Conserver temporairement le transfert TAR/SSH comme secours, avec vérification des empreintes et sans rebuild NAS',
    ],
    status: 'todo',
    priority: 'high',
    notes: 'Parcours : développement local → push/PR → CI → registre → préproduction → validation humaine → production. Les images de production sont celles validées en préproduction. Aucun workflow ni déploiement activé par cette entrée.',
  },
  {
    title: 'Impots : frontend',
    description: [
      '[ ] Integrer la logique frontend',
    ],
    status: 'todo',
    targetVersion: '2.2.0',
    priority: 'low',
  },
];
