import { DevTodoItem } from './dev-todo.model';

export const DEV_TODO_ITEMS: DevTodoItem[] = [
  {
    title: '[Ticket 4.1] Tableau de salaires : frontend',
    description: ['[ ] Integrer la logique frontend'],
    status: 'in-progress',
    targetVersion: '1.3.0',
    priority: 'medium',
  },
  {
    title: '[Ticket 4.2] Tableau de salaires : backend',
    description: ['[ ] Integrer la logique backend'],
    status: 'todo',
    targetVersion: '1.3.0',
    priority: 'medium',
  },
  {
    title: '[Ticket 7] Impots : frontend',
    description: ['[ ] Integrer la logique frontend'],
    status: 'todo',
    targetVersion: '1.4.0',
    priority: 'high',
  },
  {
    title: '[Ticket 9] Transactions : Recurrences hebdomadaires',
    description: [
      '[ ] Correction du calcul des transactions recurrentes hebdomadaires',
    ],
    status: 'in-progress',
    targetVersion: '1.3.0',
    priority: 'medium',
  },
  {
    title: '[Ticket 10] Ameliorations UI/UX',
    description: [
      "[X] Modal Nouvelle transaction : Ajouter la fonctionnalite d'ajout de sous-categories directement dans la liste deroulante des categories",
      '[ ] Modal Nouvelle transaction : Textebox montant - Avoir la meme coherence que celle de Nouvelle recurrence',
    ],
    status: 'in-progress',
    targetVersion: '1.3.0',
    priority: 'medium',
  },
];
