import { DevTodoItem } from './dev-todo.model';

export const DEV_TODO_ITEMS: DevTodoItem[] = [
  {
    title: '[Ticket 4.1] Tableau de salaires : frontend',
    description: ['[ ] Intégrer la logique frontend'],
    status: 'in-progress',
    targetVersion: '1.3.0',
    priority: 'medium',
  },
  {
    title: '[Ticket 4.2] Tableau de salaires : backend',
    description: ['[ ] Intégrer la logique backend'],
    status: 'todo',
    targetVersion: '1.3.0',
    priority: 'medium',
  },
  {
    title: '[Ticket 7] Impôts : frontend',
    description: ['[ ] Intégrer la logique frontend'],
    status: 'in-progress',
    targetVersion: '1.3.0',
    priority: 'high',
  },
  {
    title: '[Ticket 9] Transactions : Récurrences hebdomadaires',
    description: [
      '[ ] Correction du calcul des transactions récurrentes hebdomadaires',
    ],
    status: 'in-progress',
    targetVersion: '1.3.0',
    priority: 'medium',
  },
];
