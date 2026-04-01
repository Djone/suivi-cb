import { DevTodoItem } from '../dev-todo/dev-todo.model';

export interface ReleaseNotesSection {
  version: string;
  items: DevTodoItem[];
}

export const RELEASE_NOTES_HISTORY: ReleaseNotesSection[] = [
  {
    version: '1.4.0',
    items: [
      {
        title: 'Transactions : Recurrences hebdomadaires',
        description: [
          '[X] Correction du calcul des transactions recurrentes hebdomadaires',
        ],
        status: 'done',
        targetVersion: '1.4.0',
        priority: 'medium',
      },
      {
        title: 'Epargne : Transfert interne',
        description: [
          '[X] Créer une page dédiée pour les transferts internes entre comptes d’épargne',
          '[X] Intégrer la création de portefeuilles d’épargne dans cette page',
        ],
        status: 'done',
        targetVersion: '1.4.0',
        priority: 'medium',
      },
    ],
  },
  {
    version: '1.3.0',
    items: [
      {
        title: 'Ameliorations UI/UX',
        description: [
          "[X] Modal Nouvelle transaction : Ajouter la fonctionnalite d'ajout de sous-categories directement dans la liste deroulante des categories",
          '[X] Modal Nouvelle transaction : Textebox montant - Avoir la meme coherence que celle de Nouvelle recurrence',
          '[X] Modal Nouvelle transaction : liste déroulante catégorie - Avoir la meme coherence que celle de Nouvelle recurrence',
          '[X] Modal Nouvelle transaction : Rendre une autocompletion intelligente pour la textbox "Description"',
          '[X] Modal Nouvelle transaction : Avoir la possibilité de taguer une transaction du compte courant comme "Avance compte joint" : attribuer une couleur differente dans le tableau de transactions; lui associer une icone "tick" cliquable dans la liste des transactions; quand on clique sur cette icone, la transaction est automatiquement déversée dans le compte joint et la transaction du compte courant est supprimée',
        ],
        status: 'done',
        targetVersion: '1.3.0',
        priority: 'medium',
      },
    ],
  },
  {
    version: '1.2.0',
    items: [
      {
        title:
          'Sous-catégories : Supprimer la partie dédiée dans le menu opérations',
        description: [
          '[X] Supprimer le lien dans le menu latéral',
          '[X] Supprimer les fichiers associés (composant, service, modèle, données de test)',
        ],
        status: 'done',
        targetVersion: '1.2.0',
        priority: 'medium',
      },
      {
        title: 'Data : Import des anciennes transactions ',
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
        title: 'Data : MAJ des données',
        description: [
          "[X] Intégrer l'historique des modifications de catégories et sous-catégories",
          "[X] Vérifier l'intégrité des données après import",
        ],
        status: 'done',
        targetVersion: '1.2.0',
        priority: 'high',
      },
      {
        title: 'Compte Joint : répartition par couple',
        description: [
          '[X] Calcul de la répartition 1/3 - 2/3 ou 50/50 en fonction du salaire',
          '[X] Créer une interface front pour gérer cette répartition',
        ],
        status: 'done',
        targetVersion: '1.2.0',
        priority: 'medium',
      },
      {
        title: 'Compte Joint - répartition par couple : Backend',
        description: ['[X] Intégrer la logique backend'],
        status: 'done',
        targetVersion: '1.2.0',
        priority: 'medium',
      },
      {
        title: 'Liste des transactions',
        description: [
          '[X] Rajouter un filtre sur les catégories et sous-catégories',
        ],
        status: 'done',
        targetVersion: '1.2.0',
        priority: 'medium',
      },
      {
        title: 'Release notes automatisées',
        description: [
          "[X] Garder l'historique des modifications dans un fichier dédié",
        ],
        status: 'done',
        targetVersion: '1.2.0',
        priority: 'high',
      },
      {
        title: 'Stats : visualisation des données',
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
