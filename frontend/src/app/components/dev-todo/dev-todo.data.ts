import { DevTodoItem } from './dev-todo.model';

export const DEV_TODO_ITEMS: DevTodoItem[] = [
  {
    title: '[Ticket 8] Bug fix : frontend',
    description: [
      "[ ] Echéances à venir : Supprimer les échéances à venir si elles n'auront pas lieu",
      "[ ] Echéances à venir : Renseigner la date du jour quand l'échéance à venir a été validée",
    ],
    status: 'in-progress',
    targetVersion: '1.4.5',
    priority: 'medium',
  },
  {
    title: '[Ticket 9] Bug fix : frontend',
    description: [
      '[ ] Transactions : revoir le design du formulaire de recherche de transactions',
      '[ ] Dialog date : revoir le design du dialog de sélection de date',
    ],
    status: 'todo',
    targetVersion: '1.4.5',
    priority: 'medium',
  },
  {
    title: '[Ticket 4.1] Tableau de salaires : frontend',
    description: ['[ ] Integrer la logique frontend'],
    status: 'in-progress',
    targetVersion: '1.4.5',
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
    targetVersion: '1.4.5',
    priority: 'high',
  },
];
