import { DevTodoItem } from '../dev-todo/dev-todo.model';

export interface ReleaseNotesSection {
  version: string;
  items: DevTodoItem[];
}

export const RELEASE_NOTES_HISTORY: ReleaseNotesSection[] = [
  {
    version: '1.2.0',
    items: [
      {
        title:
          '[Ticket 1] Sous-catégories : Supprimer la partie dédiée dans le menu opérations',
        description: [
          '[X] Supprimer le lien dans le menu latéral',
          '[X] Supprimer les fichiers associés (composant, service, modèle, données de test)',
        ],
        status: 'done',
        targetVersion: '1.2.0',
        priority: 'medium',
      },
      {
        title: '[Ticket 2.1] Data : Import des anciennes transactions ',
        description: [
          "[X] Créer un fichier d'import avec les données 2022",
          "[X] Créer un fichier d'import avec les données 2023",
          "[X] Créer un fichier d'import avec les données 2024",
          '[X] Importer les données dans la nouvelle base de données',
        ],
        status: 'done',
        targetVersion: '1.2.0',
        priority: 'high',
      },
      {
        title: '[Ticket 2.2] Data : MAJ des données',
        description: [
          "[X] Intégrer l'historique des modifications de catégories et sous-catégories",
          "[X] Vérifier l'intégrité des données après import",
        ],
        status: 'done',
        targetVersion: '1.2.0',
        priority: 'high',
      },
      {
        title: '[Ticket 3] Compte Joint : répartition par couple',
        description: [
          '[X] Calcul de la répartition 1/3 - 2/3 ou 50/50 en fonction du salaire',
          '[X] Créer une interface front pour gérer cette répartition',
        ],
        status: 'done',
        targetVersion: '1.2.0',
        priority: 'medium',
      },
      {
        title: '[Ticket 3] Compte Joint - répartition par couple : Backend',
        description: ['[X] Intégrer la logique backend'],
        status: 'done',
        targetVersion: '1.2.0',
        priority: 'medium',
      },
      {
        title: '[Ticket 5] Liste des transactions',
        description: [
          '[X] Rajouter un filtre sur les catégories et sous-catégories',
        ],
        status: 'done',
        targetVersion: '1.2.0',
        priority: 'medium',
      },
      {
        title: '[Ticket 6] Release notes automatisées',
        description: [
          "[X] Garder l'historique des modifications dans un fichier dédié",
        ],
        status: 'done',
        targetVersion: '1.2.0',
        priority: 'high',
      },
      {
        title: '[Ticket 8] Stats : visualisation des données',
        description: [
          '[X] Amélioration de la visualisation des données statistiques par mois et par catégorie / sous-catégorie',
        ],
        status: 'done',
        targetVersion: '1.2.0',
        priority: 'medium',
      },
    ],
  },
  {
    version: '1.1.0',
    items: [
      {
        title: 'Transactions récurrentes : historisation',
        description: [
          '[X] Garder une trace de chaque occurrence générée (table historique dédiée) dès que le montant est modifié.',
          '[X] Conserver : date d’exécution, montant, type, statut et référence au modèle de récurrence.',
        ],
        status: 'done',
        priority: 'medium',
        targetVersion: '1.1.0',
      },
      {
        title: "Transactions récurrentes : visualisation de l'historique",
        description: [
          '[X] Afficher l’évolution des montants dans le temps (graphique + filtre).',
          '[X] Filtrer par type de transaction / catégorie / compte bancaire.',
        ],
        status: 'done',
        priority: 'medium',
        targetVersion: '1.1.0',
      },
      {
        title: 'Catégories / Sous-catégories',
        description: [
          '[X] Affichage des sous-catégories par catégorie et par type (dépense / revenu) dans des cartes.',
          '[X] Badges avec ne nombre de transactions associées et les URLS pour leur affichage',
        ],
        status: 'done',
        priority: 'medium',
        targetVersion: '1.1.0',
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
        priority: 'medium',
        targetVersion: '1.1.0',
      },
      {
        title: "Transactions récurrentes : modification de l'UI",
        description: [
          '[X] Onglets pour les Revenus et Dépenses.',
          '[X] Grouper par compte bancaire.',
          '[X] Afficher le libellé 50/30/20 dans une colonne supplémentaire.',
        ],
        status: 'done',
        priority: 'medium',
        targetVersion: '1.1.0',
      },
    ],
  },
];
