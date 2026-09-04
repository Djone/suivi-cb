import { DevTodoItem } from './dev-todo.model';

export const DEV_TODO_ITEMS: DevTodoItem[] = [
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
    description: [
      '[ ] Integrer la logique frontend',
    ],
    status: 'todo',
    targetVersion: '1.4.5',
    priority: 'medium',
  },
  {
    title: 'Tableau de salaires : backend',
    description: [
      '[ ] Integrer la logique backend',
    ],
    status: 'todo',
    targetVersion: '1.4.0',
    priority: 'medium',
  },
  {
    title: 'Impots : frontend',
    description: [
      '[ ] Integrer la logique frontend',
    ],
    status: 'todo',
    targetVersion: '1.4.5',
    priority: 'high',
  },
];
