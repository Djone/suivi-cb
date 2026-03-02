import { DevTodoItem } from './dev-todo.model';

export const DEV_TODO_ITEMS: DevTodoItem[] = [
  {
    title: '[Ticket 4.1] Tableau de salaires : frontend',
    description: ['[ ] Integrer la logique frontend'],
    status: 'in-progress',
    targetVersion: '1.4.0',
    priority: 'medium',
  },
  {
    title: '[Ticket 4.2] Tableau de salaires : backend',
    description: ['[ ] Integrer la logique backend'],
    status: 'todo',
    targetVersion: '1.4.0',
    priority: 'medium',
  },
  {
    title: '[Ticket 7] Impots : frontend',
    description: ['[ ] Integrer la logique frontend'],
    status: 'todo',
    targetVersion: '1.5.0',
    priority: 'high',
  },
  {
    title: '[Ticket 9] Transactions : Recurrences hebdomadaires',
    description: [
      '[ ] Correction du calcul des transactions recurrentes hebdomadaires',
    ],
    status: 'in-progress',
    targetVersion: '1.4.0',
    priority: 'medium',
  },
];
