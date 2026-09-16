import { DevTodoItem } from './dev-todo.model';

export const DEV_TODO_ITEMS: DevTodoItem[] = [
  {
    title: 'Bug fix : frontend',
    description: [
      '[X] Transactions : revoir le design du formulaire de recherche de transactions',
      '[X] Dialog date : revoir le design du dialog de sélection de date',
    ],
    status: 'done',
    targetVersion: '2.1.0',
    priority: 'medium',
  },
  {
    title: 'Tableau de salaires : frontend',
    description: ['[X] Integrer la logique frontend'],
    status: 'done',
    targetVersion: '2.1.0',
    priority: 'medium',
  },
  {
    title: 'Tableau de salaires : backend',
    description: ['[X] Integrer la logique backend'],
    status: 'done',
    targetVersion: '2.1.0',
    priority: 'medium',
  },
  {
    title: 'Impots : frontend',
    description: ['[ ] Integrer la logique frontend'],
    status: 'todo',
    targetVersion: '2.2.0',
    priority: 'high',
  },
];
