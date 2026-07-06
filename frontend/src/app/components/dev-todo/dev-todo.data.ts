import { DevTodoItem } from './dev-todo.model';

export const DEV_TODO_ITEMS: DevTodoItem[] = [
  {
    title: '[Ticket 8] Bug fix : frontend',
    description: [
      "[X] Echéances à venir : Supprimer les échéances à venir si elles n'auront pas lieu",
      "[X] Echéances à venir : Renseigner la date du jour quand l'échéance à venir a été validée",
    ],
    status: 'done',
    targetVersion: '1.5.0',
    priority: 'high',
  },
  {
    title: '[Ticket 10] Epargne',
    description: [
      "[X] Epargne : Ajouter une épargne 'urgences' en plus de celle 'porefeuille' - Ajouter des tabs pour naviguer entre les deux épargnes",
    ],
    status: 'done',
    targetVersion: '1.5.0',
    priority: 'high',
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
    status: 'todo',
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
