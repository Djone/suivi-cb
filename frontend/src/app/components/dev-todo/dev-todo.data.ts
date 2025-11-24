import { DevTodoItem } from './dev-todo.model';

export const DEV_TODO_ITEMS: DevTodoItem[] = [
  {
    title:
      '[Ticket 1] Sous-catégories : Supprimer la partie dédiée dans le menu opérations',
    description: [
      '[X] Supprimer le lien dans le menu latéral.',
      '[ ] Supprimer les fichiers associés (composant, service, modèle, données de test).',
    ],
    status: 'in-progress',
    targetVersion: '1.2.0',
    priority: 'medium',
  },
];
