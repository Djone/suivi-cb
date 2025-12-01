import { DevTodoItem } from './dev-todo.model';

export const DEV_TODO_ITEMS: DevTodoItem[] = [
  {
    title:
      '[Ticket 1] Sous-catégories : Supprimer la partie dédiée dans le menu opérations',
    description: [
      '[X] Supprimer le lien dans le menu latéral',
      '[X] Supprimer les fichiers associés (composant, service, modèle, données de test)',
    ],
    status: 'done',
    targetVersion: '1.2.0',
    priority: 'medium',
  },
  {
    title: '[Ticket 2.1] Data : Import des anciennes transactions ',
    description: [
      "[X] Créer un fichier d'import avec les données 2022",
      "[X] Créer un fichier d'import avec les données 2023",
      "[X] Créer un fichier d'import avec les données 2024",
      '[X] Importer les données dans la nouvelle base de données',
    ],
    status: 'done',
    targetVersion: '1.2.0',
    priority: 'high',
  },
  {
    title: '[Ticket 2.2] Data : MAJ des données',
    description: [
      "[ ] Intégrer l'historique des modifications de catégories et sous-catégories",
      "[ ] Vérifier l'intégrité des données après import",
    ],
    status: 'in-progress',
    targetVersion: '1.2.0',
    priority: 'high',
  },
  {
    title: '[Ticket 3] Compte Joint : répartition par couple',
    description: [
      '[X] Calcul de la répartition 1/3 - 2/3 ou 50/50 en fonction du salaire',
      '[X] Créer une interface front pour gérer cette répartition',
    ],
    status: 'done',
    targetVersion: '1.2.0',
    priority: 'medium',
  },
  {
    title: '[Ticket 3] Compte Joint - répartition par couple : Backend',
    description: ['[X] Intégrer la logique backend'],
    status: 'done',
    targetVersion: '1.2.0',
    priority: 'medium',
  },
  {
    title: '[Ticket 4.1] Tableau de salaires : frontend',
    description: ['[ ] Intégrer la logique frontend'],
    status: 'in-progress',
    targetVersion: '1.2.0',
    priority: 'medium',
  },
  {
    title: '[Ticket 4.2] Tableau de salaires : backend',
    description: ['[ ] Intégrer la logique backend'],
    status: 'todo',
    targetVersion: '1.2.0',
    priority: 'medium',
  },
  {
    title: '[Ticket 5] Liste des transactions',
    description: [
      '[X] Rajouter un filtre sur les catégories et sous-catégories',
    ],
    status: 'done',
    targetVersion: '1.2.0',
    priority: 'medium',
  },
  {
    title: '[Ticket 6] Release notes automatisées',
    description: [
      "[ ] Garder l'historique des modifications dans un fichier dédié",
    ],
    status: 'todo',
    targetVersion: '1.2.0',
    priority: 'high',
  },
];
