import { DevTodoItem } from './dev-todo.model';

export const DEV_TODO_ITEMS: DevTodoItem[] = [
  {
    title: 'Amélioration UX',
    description: [
      '[X] Liste des transactions : bandeau bleu - Modification du calcul des dépenses prévues. Le montant affiché est celui des dépenses restantes à date.',
      '[X] Liste des transactions : bandeau bleu - Placer le reste à vivre sous Epargne et non à côté de Dépenses prévues',
      '[X] Dashboard et pages comptes : nouvelle interface V2 avec accès direct aux comptes courant et joint',
    ],
    status: 'done',
    targetVersion: '2.0.0',
    priority: 'medium',
  },
  {
    title: 'Bug fix',
    description: [
      "[X] Transactions récurrentes : Correction de l'affichage et calcul des transactions autres que mensuelles",
    ],
    status: 'done',
    targetVersion: '2.0.0',
    priority: 'medium',
  },
  {
    title: 'Bug fix : frontend',
    description: [
      '[ ] Transactions : revoir le design du formulaire de recherche de transactions',
      '[ ] Dialog date : revoir le design du dialog de sélection de date',
    ],
    status: 'todo',
    targetVersion: '1.4.5',
    priority: 'medium',
  },
  {
    title: 'Tableau de salaires : frontend',
    description: ['[ ] Integrer la logique frontend'],
    status: 'todo',
    targetVersion: '1.4.5',
    priority: 'medium',
  },
  {
    title: 'Tableau de salaires : backend',
    description: ['[ ] Integrer la logique backend'],
    status: 'todo',
    targetVersion: '1.4.0',
    priority: 'medium',
  },
  {
    title: 'Impots : frontend',
    description: ['[ ] Integrer la logique frontend'],
    status: 'todo',
    targetVersion: '1.4.5',
    priority: 'high',
  },
];
