import { DevTodoItem } from './dev-todo.model';

export const DEV_TODO_ITEMS: DevTodoItem[] = [
  {
    title: '[Ticket 11] Echéances à venir : frontend',
    description: [
      "[X] Echéances à venir : amélioration du fonctionnement - Sélection multiple des échéances à venir les valider; annulation de la validation d'une échéance à venir",
      "[X] Echéances à venir : amélioration du fonctionnement - Ajout d'une modale pour l'édition du montant de l'échéance à venir",
    ],
    status: 'done',
    targetVersion: '1.6.0',
    priority: 'high',
  },
  {
    title:
      '[Ticket 12] Véhicules : nouvelle page pour la gestion des véhicules',
    description: [
      "[X] Véhicules : Ajout d'une nouvelle page pour la gestion des véhicules - Ajout d'un formulaire pour l'ajout d'un véhicule - Ajout d'un tableau pour la visualisation du coût des véhicules",
    ],
    status: 'done',
    targetVersion: '1.6.0',
    priority: 'high',
  },
  {
    title: '[Ticket 13] Bug fix : frontend',
    description: [
      '[X] Epargne : Correction du calcul du solde de l’épargne “portefeuille”',
    ],
    status: 'done',
    targetVersion: '1.6.0',
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
