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
  {
    title: '[Ticket 10] Ameliorations UI/UX',
    description: [
      "[X] Modal Nouvelle transaction : Ajouter la fonctionnalite d'ajout de sous-categories directement dans la liste deroulante des categories",
      '[X] Modal Nouvelle transaction : Textebox montant - Avoir la meme coherence que celle de Nouvelle recurrence',
      '[X] Modal Nouvelle transaction : liste déroulante catégorie - Avoir la meme coherence que celle de Nouvelle recurrence',
      '[X] Modal Nouvelle transaction : Rendre une autocompletion intelligente pour la textbox "Description"',
      '[X] Modal Nouvelle transaction : Avoir la possibilité de taguer une transaction du compte courant comme "Avance compte joint" : attribuer une couleur differente dans le tableau de transactions; lui associer une icone "tick" cliquable dans la liste des transactions; quand on clique sur cette icone, la transaction est automatiquement déversée dans le compte joint et la transaction du compte courant est supprimée',
    ],
    status: 'in-progress',
    targetVersion: '1.3.0',
    priority: 'medium',
  },
];
