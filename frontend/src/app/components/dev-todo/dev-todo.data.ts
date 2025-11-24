import { DevTodoItem } from './dev-todo.model';

export const DEV_TODO_ITEMS: DevTodoItem[] = [
  {
    title: 'Transactions récurrentes : historisation',
    description: [
      '[X] Garder une trace de chaque occurrence générée (table historique dédiée) dès que le montant est modifié.',
      "[X] Conserver : date d'exécution, montant, type, statut et référence au modèle de récurrence.",
    ],
    status: 'done',
    targetVersion: '1.1.0',
    priority: 'medium',
  },
  {
    title: "Transactions récurrentes : visualisation de l'historique",
    description: [
      '[X] Afficher l’évolution des montants dans le temps (graphique + filtre).',
      '[X] Filtrer par type de transaction / catégorie / compte bancaire.',
    ],
    status: 'done',
    targetVersion: '1.1.0',
    priority: 'medium',
  },
  {
    title: 'Catégories / Sous-catégories',
    description: [
      '[X] Affichage des sous-catégories par catégorie et par type (dépense / revenu) dans des cartes.',
      '[X] Badges avec ne nombre de transactions associées et les URLS pour leur affichage',
    ],
    status: 'done',
    targetVersion: '1.1.0',
    priority: 'high',
  },
  {
    title: 'Dashboard : mise à jour des notifications',
    description: [
      "[X] Montant total de l'épargne mensuelle à jour en fonction des transactions ajoutées/supprimées.",
      '[X] Prévision en baisse',
      '[X] prochaines transactions pour les 5 prochains jours',
      '[X] Prévision des prochains gros montants.',
      '[X] Afficher une notification si une catégorie 50/30/20 est dépassée.',
    ],
    status: 'done',
    targetVersion: '1.1.0',
    priority: 'high',
  },
  {
    title: "Transactions récurrentes : modification de l'UI",
    description: [
      '[X] Onglets pour les Revenus et Dépenses.',
      '[X] Grouper par compte bancaire.',
      '[X] Afficher le libellé 50/30/20 dans une colonne supplémentaire.',
    ],
    status: 'done',
    targetVersion: '1.1.0',
    priority: 'low',
  },
  {
    title:
      "Application : Automatisation de la version + Ajout d'une page Release Note",
    description: [
      '[X] Créer automatiquement une page listant les nouveautés à chaque version grâce aux TODO marqués comme done.',
      "[ ] Automatiser l'incrémentation de la version à chaque build (semver).",
    ],
    status: 'in-progress',
    targetVersion: '1.1.0',
    priority: 'high',
  },
];
